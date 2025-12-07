#!/usr/bin/env python3
import base64
import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from io import BytesIO

import cloudinary
import cloudinary.api
import cloudinary.uploader
import pandas as pd
import redis
from dotenv import load_dotenv
from flask import Flask, abort, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

# Embeddings for vector store
from PyPDF2 import PdfReader
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from sqlalchemy import MetaData, create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.schema import CreateIndex, CreateTable

from chat_agent import VisualizerBot
from config import DEBUG, N_SAMPLES, SCHEDULER_RESET_MIN
from SQLChatManager import SQLChatHistoryManager
from auth import (
    admin_required,
    authenticate_demo_user,
    generate_access_token,
    token_required,
)
from langchain_core.messages import HumanMessage, SystemMessage
from transaction_service import (
    TRANSACTION_MUTABLE_FIELDS,
    create_transaction,
    create_ocr_history,
    delete_transaction,
    get_transaction,
    get_ocr_history_entry,
    list_ocr_history,
    list_transactions,
    normalize_transaction_payload,
    update_ocr_history,
    update_transaction,
)

# from langchain_chroma import Chroma


load_dotenv()
# Schema caching
redis_host = os.getenv("REDIS_HOST")
redis_port = os.getenv("REDIS_PORT")
redis_client = redis.Redis(host=redis_host, port=redis_port)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin-pln")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "AdminPLN!2025")
PASSWORD_KEY_PREFIX = "auth:userpwd:"

app = Flask(__name__)
CORS(app)

# LLM Models
model = ChatOpenAI(model="gpt-4o", temperature=0.3, max_tokens=10000)
image_model = ChatOpenAI(model="gpt-4o", temperature=0.3, max_tokens=10000)

chat_manager = SQLChatHistoryManager(app)


# Konfigurasi Cloudinary
CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
API_KEY = os.getenv("CLOUDINARY_API_KEY")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=API_KEY,
    api_secret=API_SECRET,
)

# Connect to the database
schema_valid = redis_client.get("sql_schema") is not None

# Database untuk scheduler
DB_USER_SCHED = os.getenv("DB_USER")
DB_PASSWORD_SCHED_RAW = os.getenv("DB_PASSWORD")
DB_PASSWORD_SCHED = (
    str(DB_PASSWORD_SCHED_RAW).replace("@", "%40").replace("%23", "#")
    if DB_PASSWORD_SCHED_RAW
    else ""
)
DB_HOST_SCHED = os.getenv("DB_HOST")
DB_NAME_SCHED = os.getenv("DB_NAME")
DB_PORT_SCHED_RAW = os.getenv("DB_PORT")
DB_PORT_SCHED = None
if DB_PORT_SCHED_RAW is not None:
    port_candidate = str(DB_PORT_SCHED_RAW).strip()
    DB_PORT_SCHED = (
        port_candidate if port_candidate and port_candidate.lower() != "none" else None
    )

if DB_PORT_SCHED:
    sched_db_uri = (
        f"mysql+mysqlconnector://{DB_USER_SCHED}:{DB_PASSWORD_SCHED}@"
        f"{DB_HOST_SCHED}:{DB_PORT_SCHED}/{DB_NAME_SCHED}"
    )
else:
    sched_db_uri = (
        f"mysql+mysqlconnector://{DB_USER_SCHED}:{DB_PASSWORD_SCHED}@"
        f"{DB_HOST_SCHED}/{DB_NAME_SCHED}"
    )

engine = create_engine(
    sched_db_uri,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_pre_ping=True,
)

# connection = engine.connect()

metadata = MetaData()

# Connect to the database
schema_valid = redis_client.get("sql_schema") is not None
db_schema = ""


def schedule():
    """
    Timer callback every SCHEDULE_RESET_MIN
    Invalidates the cached schema every reset interval
    """

    global db_schema

    print("[SERVER] RELOAD SCHEMA")
    # Pastikan tidak ada tugas baru sebelum yang lama selesai
    timer_thread = threading.Timer(SCHEDULER_RESET_MIN * 60, schedule)
    timer_thread.daemon = True  # Thread akan mati jika program utama mati
    timer_thread.start()
    try:
        with engine.connect() as connection:
            metadata.clear()
            metadata.reflect(bind=engine)
            print("CONNECTED")
            # Loop through each table in the database

            db_schema = ""
            for table in metadata.sorted_tables:
                try:
                    # Add the CREATE TABLE statement to `db_schema`
                    db_schema += str(CreateTable(table).compile(engine)) + ";\n\n"

                    # Add header indicating sample data
                    db_schema += f"-- Sample data from `{table.name}`:\n"

                    # Fetch column names for displaying headers
                    column_names = [column.name for column in table.columns]
                    db_schema += "\t".join(column_names) + "\n"

                    # Execute a query to get the first 3 rows of the table
                    result = connection.execute(
                        table.select().limit(N_SAMPLES)
                    ).fetchall()

                    # Format and add each row of sample data
                    for row in result:
                        row_data = "\t".join(
                            str(value) if value is not None else "NULL" for value in row
                        )
                        db_schema += row_data + "\n"

                    # Add a newline to separate data of different tables
                    db_schema += "\n\n"
                except SQLAlchemyError as e:
                    print(f"Error fetching data for table {table.name}: {e}")

            redis_client.set("sql_schema", db_schema)
            print("[SERVER] Saved Schema")
    except SQLAlchemyError as e:
        print(f"Error fetching data: {e}")
    finally:
        print("[SERVER] Schedule task finished.")


schedule()

if schema_valid:
    print("[SERVER] Got Schema")
    db_schema = redis_client.get("sql_schema").decode("utf-8")


# Bot app
bot = VisualizerBot(
    model,
    image_model,
    engine,
    db_schema,
    chatManager=chat_manager,
    plot=True,
    refinePlot=False,
)


# cloudinary function
def upload_cloudinary_image(img_bytes):
    # Use BytesIO to turn img_bytes into a file-like object
    img_file = BytesIO(img_bytes)

    # Upload the image to Cloudinary
    response = cloudinary.uploader.upload(img_file, resource_type="image")

    # Get the uploaded image URL
    image_url = response["secure_url"]

    return str(image_url)


def generate_room_title(prompt: str) -> str:
    """
    Create a short, human-readable title from the first user prompt.
    """
    if not prompt:
        return "New conversation"

    cleaned = " ".join(prompt.strip().split())
    if len(cleaned) <= 48:
        return cleaned

    truncated = cleaned[:48]
    last_space = truncated.rfind(" ")
    if last_space > 20:
        truncated = truncated[:last_space]

    return f"{truncated.strip()}..."


def extract_text_and_meta_from_pdf(file_bytes: bytes) -> tuple[str, int]:
    """
    Extract raw text and page count from a PDF file. Acts as a lightweight OCR fallback for admin uploads.
    """
    page_count = 0
    try:
        reader = PdfReader(BytesIO(file_bytes))
        texts = []
        page_count = len(reader.pages)
        for page in reader.pages:
            try:
                page_text = page.extract_text() or ""
                if page_text:
                    texts.append(page_text)
            except Exception as page_err:
                print(f"[OCR] Failed to read page: {page_err}")
        return "\n\n".join(texts).strip(), page_count
    except Exception as exc:
        print(f"[OCR] Failed to parse PDF: {exc}")
        return "", page_count


def _parse_json_like(text) -> dict:
    """
    Try to coerce a model response into a JSON object, even when wrapped in
    Markdown fences or arrays.
    """
    if text is None:
        return {}

    # If already a dict/list from the model, return the first object
    if isinstance(text, dict):
        return text
    if isinstance(text, list):
        return text
    if isinstance(text, (bytes, bytearray)):
        try:
            text = text.decode("utf-8")
        except Exception:
            text = str(text)

    cleaned = text.strip()

    def _return(parsed: object):
        return parsed

    # If text is already JSON-like
    try:
        return _return(json.loads(cleaned))
    except Exception:
        pass

    # Look for fenced code blocks anywhere, not just the whole string
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if fence_match:
        fenced = fence_match.group(1).strip()
        try:
            return _return(json.loads(fenced))
        except Exception:
            cleaned = fenced  # continue with other heuristics

    # Try to pull the first JSON array or object from the text (prioritize arrays)
    try:
        array_match = re.search(r"\[[\s\S]*\]", cleaned)
        if array_match:
            return _return(json.loads(array_match.group(0)))

        object_match = re.search(r"\{[\s\S]*\}", cleaned)
        if object_match:
            return _return(json.loads(object_match.group(0)))
    except Exception:
        return {}

    return {}


def extract_transaction_from_text(raw_text: str) -> dict:
    """
    Ask the LLM to normalize the PDF text into a transaction payload.
    """
    if not raw_text:
        return {}

    system_prompt = (
        "You are a transaction data extraction assistant. "
        "Return JSON with exactly the following keys (only these should be populated): "
        f"{', '.join(TRANSACTION_MUTABLE_FIELDS)}. "
        "Include id_transaksi only if it is explicitly mentioned in the document as a reference, "
        "and do not change any other key names. If the PDF contains multiple rows, pick the most complete single row "
        "and only return that one object. Do not return arrays. "
        "Keep the field names unchanged. "
        "Fill in any string or numeric values you find; use null if the value is missing."
    )

    truncated = raw_text[:6000]
    messages = [
        SystemMessage(
            content=(
                system_prompt
                + " Respond with a single JSON object only (no code fences, no arrays, no extra text)."
            )
        ),
        HumanMessage(
            content=(
                "Extract the transaction data from the following text. "
                "If any information is missing, simply set it to null.\n\n"
                f"{truncated}"
            )
        ),
    ]

    response = None
    try:
        # Prefer structured responses to reduce parsing failures
        response = model.invoke(messages, response_format={"type": "json_object"})
    except Exception as exc:
        print(f"[OCR] Structured LLM extraction failed, retrying without enforced JSON: {exc}")
        try:
          response = model.invoke(messages)
        except Exception as final_exc:
            print(f"[OCR] LLM extraction failed: {final_exc}")
            return {}

    raw_content = response.content
    content = raw_content if isinstance(raw_content, str) else raw_content
    parsed = _parse_json_like(content)
    if not parsed:
        print(f"[OCR] Could not parse LLM response: {content}")
    return parsed


def _password_key(username: str) -> str:
    """
    Build a stable Redis key for storing password hashes per user.
    """

    safe_username = (username or "").strip().lower()
    return f"{PASSWORD_KEY_PREFIX}{safe_username}"


def store_user_password(username: str, raw_password: str) -> bool:
    """
    Persist a hashed password in DB (primary) and Redis (legacy cache).
    """

    if not raw_password:
        return False

    try:
        hashed = generate_password_hash(raw_password)
        chat_manager.set_user_password(username, hashed)
        redis_client.set(_password_key(username), hashed)
        return True
    except Exception as exc:
        print(f"[AUTH] Failed to store password for {username}: {exc}")
        return False


def verify_user_password(username: str, raw_password: str) -> bool | None:
    """
    Check a user password stored in Redis. Returns:
      * True  -> password matches
      * False -> password exists but does not match
      * None  -> no password stored / Redis unreachable
    """

    try:
        db_user = chat_manager.get_user_by_username(username)
        if db_user and db_user.password:
            return check_password_hash(db_user.password, raw_password)

        stored = redis_client.get(_password_key(username))
        if not stored:
            return None

        hashed = stored.decode("utf-8") if isinstance(stored, bytes) else str(stored)
        return check_password_hash(hashed, raw_password)
    except Exception as exc:
        print(f"[AUTH] Failed to verify password for {username}: {exc}")
        return None


@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    Authenticate using a static password from environment and
    a dynamic username stored in the database.
    """
    payload = request.get_json() or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    if not username or not password:
        return (
            jsonify(
                {
                    "status_code": "AUTH-400",
                    "error": "Username and password are required",
                }
            ),
            400,
        )

    if username == ADMIN_USERNAME:
        return (
            jsonify(
                {
                    "status_code": "AUTH-403",
                    "error": "Use the admin login endpoint",
                }
            ),
            403,
        )

    password_check = verify_user_password(username, password)
    password_valid = (
        password_check
        if password_check is not None
        else authenticate_demo_user(password)
    )

    if not password_valid:
        return (
            jsonify({"status_code": "AUTH-401", "error": "Invalid credentials"}),
            401,
        )

    user = chat_manager.get_user_by_username(username)
    user_id = user.user_id if user else chat_manager.get_or_create_user(username)
    if not user_id:
        return (
            jsonify({"status_code": "AUTH-500", "error": "Failed to load user profile"}),
            500,
        )

    token = generate_access_token(user_id, username)
    return (
        jsonify(
            {
                "status_code": "AUTH-000",
                "message": "Login success",
                "token": token,
                "user": {"id": user_id, "username": username},
            }
        ),
        200,
    )


@app.route("/api/auth/register", methods=["POST"])
def register_user():
    """
    Register a new user with username & password, store the credential hash, and
    issue an access token for immediate login.
    """

    payload = request.get_json() or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    if not username or not password:
        return (
            jsonify(
                {
                    "status_code": "AUTH-400",
                    "error": "Username and password are required",
                }
            ),
            400,
        )

    if username == ADMIN_USERNAME:
        return (
            jsonify(
                {
                    "status_code": "AUTH-403",
                    "error": "Use the admin account through the dedicated admin page",
                }
            ),
            403,
        )

    user_id = chat_manager.get_or_create_user(username)
    if not user_id:
        return (
            jsonify(
                {
                    "status_code": "AUTH-500",
                    "error": "Failed to create user profile",
                }
            ),
            500,
        )

    store_user_password(username, password)

    token = generate_access_token(user_id, username)
    return (
            jsonify(
                {
                    "status_code": "AUTH-000",
                    "message": "Registration successful, you're signed in.",
                    "token": token,
                    "user": {"id": user_id, "username": username},
                }
        ),
        201,
    )

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    """
    Simple admin authentication using a dedicated credential from environment variables.
    """
    payload = request.get_json() or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    if not username or not password:
        return (
            jsonify(
                {
                    "status_code": "AUTH-400",
                    "error": "Admin username and password are required",
                }
            ),
            400,
        )

    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        return (
            jsonify(
                {
                    "status_code": "AUTH-401",
                    "error": "Invalid admin credentials",
                }
            ),
            401,
        )

    chat_user_id = chat_manager.get_or_create_user(username)
    if not chat_user_id:
        return (
            jsonify(
                {
                    "status_code": "AUTH-500",
                    "error": "Failed to prepare chatbot profile for admin",
                }
            ),
            500,
        )

    token = generate_access_token(chat_user_id, username, role="admin")
    return (
        jsonify(
            {
                "status_code": "AUTH-000",
                "message": "Admin login successful",
                "token": token,
                "user": {
                    "id": chat_user_id,
                    "chat_user_id": chat_user_id,
                    "username": username,
                    "role": "admin",
                },
            }
        ),
        200,
    )


@app.route("/api/new_room", methods=["POST"])
@token_required
def create_room():
    """
    Create a room through the `ChatHistoryManager` interface

    Body:
     * `room_name` (str): name of room
     * `user_id` (int): user id

    Returns:
     * `room_id` (int): ID of the new room

    Throws an exception if cannot create the room
    """

    try:
        payload = request.get_json() or {}
        room_name = payload.get("room_name")
        request_user_id = payload.get("user_id")
        user_id = getattr(g, "user_id", None)

        if not user_id:
            return (
                jsonify({"status_code": "AUTH-401", "error": "Missing user context"}),
                401,
            )

        if request_user_id and str(request_user_id) != str(user_id):
            return (
                jsonify({"status_code": "AUTH-403", "error": "User mismatch"}),
                403,
            )

        room_name = room_name or "New chat"
        room_id = chat_manager.create_room(user_id, room_name)
        if not room_id:
            return (
                jsonify({"status_code": "BOT-500", "error": "Failed to create room"}),
                500,
            )
        return jsonify(
            {
                "status_code": "BOT-000",
                "message": "Create room success",
                "room_id": room_id,
                "room_name": room_name,
            }
        )
    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "there's something wrong"}),
            500,
        )


@app.route("/api/<user_id>/rooms", methods=["GET"])
@token_required
def get_rooms(user_id):
    """
    Get all rooms for the user with pagination

    Query Parameters:
        limit (int): Number of records per page
        offset (int): Number of records to skip

    Returns:
        JSON response with paginated rooms data and total count
    """
    try:
        token_user_id = getattr(g, "user_id", None)
        if token_user_id is None or str(token_user_id) != str(user_id):
            return (
                jsonify({"status_code": "AUTH-403", "error": "User mismatch"}),
                403,
            )

        try:
            numeric_user_id = int(user_id)
        except (TypeError, ValueError):
            return (
                jsonify({"status_code": "AUTH-400", "error": "Invalid user id"}),
                400,
            )

        limit = request.args.get("limit", default=10, type=int)
        offset = request.args.get("offset", default=0, type=int)

        rooms, total_count = chat_manager.get_all_rooms(
            numeric_user_id, limit, offset
        )

        return jsonify(
            {
                "status_code": "BOT-000",
                "message": "Get room success",
                "total_count": total_count,
                "data": rooms,
            }
        )
    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "there's something wrong"}),
            500,
        )


@app.route("/api/analytics/weekly_activity", methods=["GET"])
@token_required
def weekly_activity():
    """
    Return aggregated chat activity for the last 7 days for the authenticated user.
    """
    try:
        user_id = getattr(g, "user_id", None)
        if user_id is None:
            return (
                jsonify({"status_code": "AUTH-401", "error": "Missing user context"}),
                401,
            )

        data = chat_manager.get_weekly_activity(int(user_id))
        return (
            jsonify(
                {
                    "status_code": "ANL-000",
                    "message": "Get weekly activity success",
                    "data": data,
                }
            ),
            200,
        )
    except Exception as e:
        return (
            jsonify({"status_code": "ANL-999", "error": "Failed to load activity"}),
            500,
        )


@app.route("/api/admin/transactions", methods=["GET", "POST"])
@admin_required
def admin_transactions():
    """
    Admin-only CRUD endpoint for transactions.
    """
    try:
        if request.method == "GET":
            data = list_transactions()
            return (
                jsonify(
                    {
                        "status_code": "ADM-000",
                        "message": "Transaction list",
                        "data": data,
                    }
                ),
                200,
            )

        payload = request.get_json() or {}
        created = create_transaction(payload)
        return (
            jsonify(
                {
                    "status_code": "ADM-000",
                    "message": "Transaction created successfully",
                    "data": created,
                }
            ),
            201,
        )
    except Exception as exc:
        return (
            jsonify(
                {
                    "status_code": "ADM-999",
                    "error": f"Failed to process transaction: {exc}",
                }
            ),
            500,
        )


@app.route("/api/admin/transactions/<trans_id>", methods=["PUT", "DELETE"])
@admin_required
def admin_transaction_detail(trans_id):
    try:
        if request.method == "PUT":
            payload = request.get_json() or {}
            updated = update_transaction(trans_id, payload)
            if not updated:
                return (
                    jsonify(
                        {
                            "status_code": "ADM-404",
                            "error": "Transaction not found",
                        }
                    ),
                    404,
                )
            return (
                jsonify(
                        {
                            "status_code": "ADM-000",
                            "message": "Transaction updated",
                            "data": updated,
                        }
                    ),
                200,
            )

        # DELETE
        removed = delete_transaction(trans_id)
        if not removed:
            return (
                jsonify(
                    {"status_code": "ADM-404", "error": "Transaction not found"}
                ),
                404,
            )
        return (
            jsonify(
                {
                    "status_code": "ADM-000",
                    "message": "Transaction deleted",
                    "data": {"id_transaksi": trans_id},
                }
            ),
            200,
        )
    except Exception as exc:
        return (
            jsonify(
                {
                    "status_code": "ADM-999",
                    "error": f"Failed to process transaction: {exc}",
                }
            ),
            500,
        )


@app.route("/api/admin/transactions/upload", methods=["POST"])
@admin_required
def admin_upload_transaction():
    """
    Upload a PDF, extract text, run through LLM, and save/return a transaction payload.
    """
    history_id = None
    try:
        if "file" not in request.files:
            return (
                jsonify({"status_code": "ADM-400", "error": "A PDF file is required"}),
                400,
            )

        file = request.files["file"]
        if not file or not file.filename.lower().endswith(".pdf"):
            return (
                jsonify(
                    {"status_code": "ADM-400", "error": "Hanya file PDF yang diterima"}
                ),
                400,
            )

        file_bytes = file.read()
        raw_text, page_count = extract_text_and_meta_from_pdf(file_bytes)

        history_id = create_ocr_history(
            filename=file.filename,
            filesize=len(file_bytes),
            page_count=page_count,
            status="processing",
            message="Uploading & processing document",
        )

        llm_result = extract_transaction_from_text(raw_text)

        # Support multiple rows: normalize each record. Keep first for response/UI.
        records = llm_result if isinstance(llm_result, list) else [llm_result]
        persisted_records = []

        target_id = request.form.get("id_transaksi")

        for idx, rec in enumerate(records):
            payload = normalize_transaction_payload(rec or {})

            # Only attempt to update a specific id for the first record
            use_target = target_id if idx == 0 else None
            target_exists = use_target and get_transaction(use_target)
            if use_target and target_exists:
                persisted = update_transaction(use_target, payload)
            else:
                persisted = create_transaction(payload)
            if persisted:
                persisted_records.append(persisted)

        if history_id:
            try:
                persisted_first = persisted_records[0] if persisted_records else None
                persisted_id = int(str(persisted_first.get("id_transaksi"))) if persisted_first else None
            except Exception:
                persisted_id = None
            update_ocr_history(
                history_id,
                "success",
                transaksi_id=persisted_id,
                message="Document extracted successfully",
                fields=persisted_first if persisted_first else (records[0] if records else {}),
                ocr_preview=(raw_text or "")[:1200],
            )

        return (
            jsonify(
                {
                    "status_code": "ADM-000",
                    "message": "Document extracted successfully",
                    "data": persisted_records,
                    "history": get_ocr_history_entry(history_id) if history_id else None,
                }
            ),
            200,
        )
    except Exception as exc:
        if history_id:
            update_ocr_history(history_id, "failed", message=str(exc))
        return (
            jsonify(
                {
                    "status_code": "ADM-999",
                    "error": f"Failed to process upload: {exc}",
                }
            ),
            500,
        )


@app.route("/api/admin/ocr-history", methods=["GET"])
@admin_required
def admin_ocr_history():
    """
    Provide OCR processing history for admin users.
    """
    limit = request.args.get("limit", default=30, type=int)
    try:
        history = list_ocr_history(limit=limit)
        return (
            jsonify(
                {
                    "status_code": "ADM-000",
                    "message": "OCR history",
                    "data": history,
                }
            ),
            200,
        )
    except Exception as exc:
        return (
            jsonify(
                {
                    "status_code": "ADM-999",
                    "error": f"Failed to load OCR history: {exc}",
                }
            ),
            500,
        )


@app.route("/api/create_user", methods=["POST"])
def create_user():
    """
    Create user from username

    ### Body:
        `username`: username for the new user, must be unique

    ### Returns:
        `user_id`: id of the new user
    """

    try:
        username = request.get_json().get("username")
    except:
        return (
            jsonify({"status_code": "BOT-999", "error": "There's something wrong"}),
            500,
        )

    if not username:
        return (
            jsonify({"status_code": "BOT-400", "error": "Username is required"}),
            400,
        )

    if str(username).strip() == ADMIN_USERNAME:
        return (
            jsonify(
                {
                    "status_code": "BOT-403",
                    "error": "This username is reserved for the admin and cannot be created manually",
                }
            ),
            403,
        )

    try:
        return (
            jsonify(
                {
                    "status_code": "BOT-000",
                    "message": "Create user success",
                    "user_id": chat_manager.create_user(username),
                }
            ),
            200,
        )
    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "There's something wrong"}),
            500,
        )


@app.route("/api/rooms/<room_id>/messages/bot", methods=["POST"])
@token_required
def post_prompt(room_id):
    """
    Helper function to post user prompt to the bot.

    Params:
        - room_id: room id to message to

        Body:
        - user_prompt:
            user prompt to the chatting agent
        - user_id:
            user id to the chatting agent
        - prompt_type:
            type of prompt, can either be CONVERSATION or QUERY.

        Returns:
        - {
            image: image of the chat response (in a cloudinary url)
            text: text response of the AI agent.
        }

    """
    try:
        payload = request.get_json() or {}
        user_prompt = payload.get("user_prompt")
        request_user_id = payload.get("user_id")
        user_id = getattr(g, "user_id", None)

        if not user_id:
            return (
                jsonify({"status_code": "AUTH-401", "error": "Missing user context"}),
                401,
            )

        if request_user_id and str(request_user_id) != str(user_id):
            return (
                jsonify({"status_code": "AUTH-403", "error": "User mismatch"}),
                403,
            )

        try:
            numeric_room_id = int(room_id)
        except (TypeError, ValueError):
            return (
                jsonify({"status_code": "BOT-400", "error": "Invalid room id"}),
                400,
            )

        if not chat_manager.room_belongs_to_user(numeric_room_id, int(user_id)):
            return (
                jsonify(
                    {"status_code": "BOT-403", "error": "Room not accessible for user"}
                ),
                403,
            )
        image_link = None

        if not user_prompt:
            return jsonify({"error": "user prompt is required"}), 400

        try:
            chat_manager.ensure_room_name(
                numeric_room_id, generate_room_title(user_prompt)
            )
        except (ValueError, TypeError):
            pass

        response = bot.run(user_prompt, numeric_room_id, user_id)

        # After getting the response, insert it inside the database,
        # for both the message itself, and also the plot image.
        resp_content = response.get("summarized_output")

        xlsx_link = None
        if response.get("export_csv") and response["pandas_dump"] is not None:
            export_out = BytesIO()
            df: pd.DataFrame = response["pandas_dump"]
            with pd.ExcelWriter(export_out, engine="xlsxwriter") as writer:
                df.to_excel(writer, index=False)

            export_out.seek(0)
            cloudinary_upload = cloudinary.uploader.upload(
                export_out,
                resource_type="raw",
                format="xlsx",
            )

            xlsx_link = cloudinary_upload["secure_url"]

        if response.get("router_result", None) == "PLOT":
            image_bytes = base64.b64decode(response["image_base64"])
            image_link = upload_cloudinary_image(image_bytes)

            image_msg_pic = {
                "text": image_link,
                "timestamp": None,
                "user_id": user_id,
                "room_id": numeric_room_id,
                "role": "bot",
                "data_type": "image",
            }

            chat_manager.enter_message(SQLChatHistoryManager.Message(**image_msg_pic))

            # Create a new user message, and insert it into the chat database
            new_message = {
                "text": user_prompt,
                "timestamp": None,
                "user_id": user_id,
                "room_id": numeric_room_id,
                "role": "user",
                "data_type": "text",
            }

            new_message = SQLChatHistoryManager.Message(**new_message)
            chat_manager.enter_message(new_message)

            bot_message = {
                "text": resp_content,
                "timestamp": None,
                "image_url": image_link,
                "document_url": xlsx_link,
                "excel_url": xlsx_link,
                "user_id": user_id,
                "room_id": numeric_room_id,
                "role": "bot",
                "data_type": "text",
                "df": None,
            }

            chat_manager.enter_message(SQLChatHistoryManager.Message(**bot_message))

            return (
                jsonify(
                    {
                        "status_code": "BOT-000",
                        "data": {
                            "text": response["summarized_output"],
                            "document": xlsx_link,
                            "excel": xlsx_link,
                            "image": image_link,
                        },
                        "message": "Bot run success",
                    }
                ),
                200,
            )

        # Create a new user message, and insert it into the chat database
        new_message = {
            "text": user_prompt,
            "timestamp": None,
            "user_id": user_id,
            "room_id": numeric_room_id,
            "role": "user",
            "data_type": "text",
        }

        new_message = SQLChatHistoryManager.Message(**new_message)
        chat_manager.enter_message(new_message)

        bot_message = {
            "text": resp_content,
            "timestamp": None,
            "image_url": image_link,
            "document_url": xlsx_link,
            "excel_url": xlsx_link,
            "user_id": user_id,
            "room_id": numeric_room_id,
            "role": "bot",
            "data_type": "text",
            "df": None,
        }

        chat_manager.enter_message(SQLChatHistoryManager.Message(**bot_message))

        return (
            jsonify(
                {
                    "status_code": "BOT-000",
                    "data": {
                        "text": response["summarized_output"],
                        "document": xlsx_link,
                        "excel": xlsx_link,
                        "image": image_link,
                    },
                    "message": "Bot run success",
                }
            ),
            200,
        )

    except Exception as e:
        return (
            jsonify(
                {
                    "status_code": "BOT-999",
                    "error": str(e),
                    # "error": "Sorry, I cannot answer your question",
                }
            ),
            500,
        )


@app.route("/api/rooms/<room_id>/messages", methods=["GET"])
@token_required
def get_messages(room_id):
    """
    Get all messages in a from a specific room specified by
    a room_id.

    ### Param:
     `room_id (int)`: room_id to get messsages from.

    Return
        `messages ([SQLChatManager.Message])`: list of messages in the room specified by room_id
    """
    try:
        user_id = getattr(g, "user_id", None)
        if user_id is None:
            return (
                jsonify({"status_code": "AUTH-401", "error": "Missing user context"}),
                401,
            )

        try:
            numeric_room_id = int(room_id)
        except (TypeError, ValueError):
            return (
                jsonify({"status_code": "BOT-400", "error": "Invalid room id"}),
                400,
            )

        if not chat_manager.room_belongs_to_user(numeric_room_id, int(user_id)):
            return (
                jsonify(
                    {"status_code": "BOT-403", "error": "Room not accessible for user"}
                ),
                403,
            )

        messages = chat_manager.get_all_messages(room_id=numeric_room_id)

        return jsonify(
            {
                "status_code": "BOT-000",
                "message": "Get message success",
                "data": messages,
            }
        )

    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "There's something wrong"}),
            500,
        )


if __name__ == "__main__":
    app.run(debug=False, port=5000)
