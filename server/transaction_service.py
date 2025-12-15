import json
import os
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from urllib.parse import unquote

import mysql.connector
from mysql.connector import MySQLConnection, pooling
from dotenv import load_dotenv

load_dotenv()

TRANSACTION_FIELDS = [
    "id_transaksi",
    "tanggal",
    "nama_produk",
    "kategori",
    "jumlah_terjual",
    "harga_satuan",
    "total_penjualan",
    "kota",
    "salesperson",
    "status_pembayaran",
    "metode_pembayaran",
    "konsumen",
]

TRANSACTION_MUTABLE_FIELDS = [
    "tanggal",
    "nama_produk",
    "kategori",
    "jumlah_terjual",
    "harga_satuan",
    "total_penjualan",
    "kota",
    "salesperson",
    "status_pembayaran",
    "metode_pembayaran",
    "konsumen",
]

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "user": os.getenv("DB_USER"),
    "password": unquote(os.getenv("DB_PASSWORD", "")),
    "database": os.getenv("DB_NAME", "u1792005_ai_reporting"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "auth_plugin": "mysql_native_password",
    "use_pure": True,  # Force pure-Python connector to avoid missing C extension DLLs
}

_pool: Optional[pooling.MySQLConnectionPool] = None


def _get_connection() -> MySQLConnection:
    """
    Return a pooled MySQL connection; fall back to a direct connection when pool fails.
    """
    global _pool
    if _pool is None:
        # Force the pure-Python driver so we don't rely on the optional C extension,
        # which is unavailable in some environments (e.g., Python 3.13 on Windows).
        _pool = pooling.MySQLConnectionPool(
            pool_name="trx_pool",
            pool_size=5,
            **DB_CONFIG,
        )
    try:
        return _pool.get_connection()
    except Exception:
        return mysql.connector.connect(**DB_CONFIG)


def _coerce_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        cleaned = str(value).replace(",", "").replace(".", "").strip()
        cleaned = re.sub(r"[^\d\-]", "", cleaned)
        if cleaned in ("", "-", None):
            return None
        return int(cleaned)
    except Exception:
        return None


def _coerce_decimal(value: Any) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    try:
        text = str(value)
        # Remove common currency markers
        text = text.replace("Rp", "").replace("IDR", "").replace("idr", "")
        # For robustness with Indonesian formatting like "Rp 3.850.000" or "Rp 3,850,000",
        # just keep digits and optional leading minus sign and drop all other characters.
        cleaned = re.sub(r"[^\d\-]", "", text)
        if cleaned in ("", "-", None):
            return None
        return Decimal(cleaned)
    except Exception:
        return None


def _coerce_date(value: Any) -> Optional[str]:
    if value in (None, "", "null", "None"):
        return None
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    try:
        text = str(value).strip()
        if not text:
            return None

        # Try common textual date formats first
        for fmt in ("%d %b %Y", "%d %B %Y", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(text[:10] if fmt == "%Y-%m-%d" and "T" in text else text, fmt)
                return parsed.strftime("%Y-%m-%d")
            except Exception:
                continue

        # Keep only YYYY-MM-DD portion if time is present
        return text.split("T")[0]
    except Exception:
        return None


def _normalize_city_name(value: Any) -> Optional[str]:
    """
    Normalize city names so that case-insensitive duplicates are mapped
    to a single canonical value from existing data.

    Example: if the database already contains "Medan" and the admin types
    "medan", the stored value will still be "Medan".
    """
    if value in (None, "", "null", "None"):
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        # Collapse internal whitespace and compare case-insensitively
        text = re.sub(r"\s+", " ", text)
        key = text.lower()

        conn = _get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT kota
                FROM transaksi
                WHERE kota IS NOT NULL
                  AND LOWER(kota) = %s
                ORDER BY id_transaksi ASC
                LIMIT 1
                """,
                (key,),
            )
            row = cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

        if row and row[0]:
            return row[0]

        # No existing canonical value found; keep the admin's input as-is.
        return text
    except Exception:
        # On any failure, fall back to the raw string to avoid blocking writes.
        try:
            return str(value).strip() or None
        except Exception:
            return None


def normalize_transaction_payload(data: Dict, include_id: bool = False) -> Dict:
    """
    Sanitize payload to only the allowed transaction fields and coerce types.
    Only the editable fields requested by product are mutated; id_transaksi can
    optionally be included for context but is never updated.
    """
    normalized: Dict[str, Any] = {}
    if include_id and "id_transaksi" in data:
        normalized["id_transaksi"] = _coerce_int(data.get("id_transaksi"))

    for field in TRANSACTION_MUTABLE_FIELDS:
        if field in data:
            value = data.get(field)
            if field == "jumlah_terjual":
                normalized[field] = _coerce_int(value)
            elif field in ("harga_satuan", "total_penjualan"):
                normalized[field] = _coerce_decimal(value)
            elif field == "tanggal":
                normalized[field] = _coerce_date(value)
            elif field == "kota":
                normalized[field] = _normalize_city_name(value)
            else:
                normalized[field] = value if value not in ("null", None, "") else None

    return normalized


def _serialize_transaction(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert MySQL row values into JSON-serialisable primitives.
    """
    serialized: Dict[str, Any] = {}
    for field in TRANSACTION_FIELDS:
        if field not in row:
            continue
        value = row.get(field)
        if isinstance(value, (datetime, date)):
            serialized[field] = value.isoformat()
        elif isinstance(value, Decimal):
            serialized[field] = float(value)
        else:
            serialized[field] = value
    return serialized


def _serialize_fields_for_json(fields: Dict[str, Any]) -> Dict[str, Any]:
    def _convert(value: Any):
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        return value

    return {key: _convert(val) for key, val in fields.items()}


def list_transactions() -> List[Dict]:
    conn = _get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id_transaksi, tanggal, nama_produk, kategori, jumlah_terjual,
                   harga_satuan, total_penjualan, kota, salesperson,
                   status_pembayaran, metode_pembayaran, konsumen
            FROM transaksi
            ORDER BY id_transaksi DESC
            """
        )
        rows = cursor.fetchall() or []
        return [_serialize_transaction(row) for row in rows]
    finally:
        cursor.close()
        conn.close()


def create_transaction(data: Dict) -> Dict:
    payload = normalize_transaction_payload(data)
    columns: List[str] = []
    values: List[Any] = []

    for field, value in payload.items():
        if field == "id_transaksi":
            continue
        columns.append(field)
        values.append(value)

    if not columns:
        # Insert a blank row to trigger auto-increment
        query = "INSERT INTO transaksi () VALUES ()"
    else:
        placeholders = ", ".join(["%s"] * len(values))
        cols = ", ".join(columns)
        query = f"INSERT INTO transaksi ({cols}) VALUES ({placeholders})"

    conn = _get_connection()
    cursor = conn.cursor()
    try:
        params = values if columns else ()
        cursor.execute(query, params)
        conn.commit()
        new_id = cursor.lastrowid
    finally:
        cursor.close()
        conn.close()

    return get_transaction(new_id) or {"id_transaksi": new_id, **payload}


def update_transaction(trans_id: str, updates: Dict) -> Optional[Dict]:
    try:
        trans_id_int = int(trans_id)
    except Exception:
        return None

    payload = normalize_transaction_payload(updates, include_id=True)
    set_parts: List[str] = []
    values: List[Any] = []

    for field, value in payload.items():
        if field == "id_transaksi":
            continue
        set_parts.append(f"{field}=%s")
        values.append(value)

    if not set_parts:
        return get_transaction(trans_id_int)

    values.append(trans_id_int)

    conn = _get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            f"UPDATE transaksi SET {', '.join(set_parts)} WHERE id_transaksi=%s",
            values,
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return get_transaction(trans_id_int)


def delete_transaction(trans_id: str) -> bool:
    try:
        trans_id_int = int(trans_id)
    except Exception:
        return False

    conn = _get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM transaksi WHERE id_transaksi=%s", (trans_id_int,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        cursor.close()
        conn.close()


def get_transaction(trans_id: str | int) -> Optional[Dict]:
    try:
        trans_id_int = int(trans_id)
    except Exception:
        return None

    conn = _get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id_transaksi, tanggal, nama_produk, kategori, jumlah_terjual,
                   harga_satuan, total_penjualan, kota, salesperson,
                   status_pembayaran, metode_pembayaran, konsumen
            FROM transaksi
            WHERE id_transaksi=%s
            """,
            (trans_id_int,),
        )
        row = cursor.fetchone()
        return _serialize_transaction(row) if row else None
    finally:
        cursor.close()
        conn.close()


# ----------------------------- OCR HISTORY ----------------------------- #


def _ensure_ocr_history_table():
    """
    Create OCR history table when missing.
    """
    conn = _get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS ocr_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transaksi_id INT NULL,
                filename VARCHAR(255) NOT NULL,
                filesize_bytes BIGINT NOT NULL,
                page_count INT NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL,
                message TEXT NULL,
                fields_json LONGTEXT NULL,
                ocr_preview LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at DATETIME NULL,
                INDEX idx_status (status),
                INDEX idx_transaksi (transaksi_id),
                CONSTRAINT fk_ocr_transaksi FOREIGN KEY (transaksi_id)
                    REFERENCES transaksi(id_transaksi) ON DELETE SET NULL
            )
            """
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


_ensure_ocr_history_table()


def create_ocr_history(
    filename: str, filesize: int, page_count: int, status: str = "processing", message: str | None = None
) -> Optional[int]:
    conn = _get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO ocr_history (filename, filesize_bytes, page_count, status, message)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (filename, filesize, page_count, status, message),
        )
        conn.commit()
        return cursor.lastrowid
    except Exception:
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


def update_ocr_history(
    history_id: int,
    status: str,
    transaksi_id: int | None = None,
    message: str | None = None,
    fields: Optional[Dict[str, Any]] = None,
    ocr_preview: Optional[str] = None,
) -> Optional[Dict]:
    conn = _get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            UPDATE ocr_history
            SET status=%s,
                transaksi_id=%s,
                message=%s,
                fields_json=%s,
                ocr_preview=%s,
                completed_at=CASE WHEN %s IN ('success','failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id=%s
            """,
            (
                status,
                transaksi_id,
                message,
                json.dumps(_serialize_fields_for_json(fields or {}), ensure_ascii=False),
                ocr_preview,
                status,
                history_id,
            ),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return get_ocr_history_entry(history_id)


def get_ocr_history_entry(history_id: int) -> Optional[Dict]:
    conn = _get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, transaksi_id, filename, filesize_bytes, page_count, status,
                   message, fields_json, ocr_preview, created_at, updated_at, completed_at
            FROM ocr_history
            WHERE id=%s
            """,
            (history_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        if row.get("fields_json"):
            try:
                row["fields_json"] = json.loads(row["fields_json"])
            except Exception:
                pass

        return {
            **row,
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
            "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
            "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
        }
    finally:
        cursor.close()
        conn.close()


def list_ocr_history(limit: int = 30) -> List[Dict]:
    conn = _get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, transaksi_id, filename, filesize_bytes, page_count, status,
                   message, fields_json, ocr_preview, created_at, updated_at, completed_at
            FROM ocr_history
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall() or []
        result: List[Dict[str, Any]] = []
        for row in rows:
            if row.get("fields_json"):
                try:
                    row["fields_json"] = json.loads(row["fields_json"])
                except Exception:
                    pass

            result.append(
                {
                    **row,
                    "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                    "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
                    "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
                }
            )
        return result
    finally:
        cursor.close()
        conn.close()
