import datetime
import io
import json
import time
from typing import Annotated, Any, Literal

import pandas as pd
import tiktoken
from langchain_community.utilities import SQLDatabase
from langchain_core.messages.base import BaseMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command

# from langchain_core.documents import Document
# from langchain_chroma import Chroma
from PIL import Image
from typing_extensions import TypedDict

# PLACEHOLDER
from AgentNodes.Generator.generator import OutputGenerator
from AgentNodes.LLMNode import LLMNode
from AgentNodes.Plotter.plot_agent_csv import PlotAgent_CSV
from AgentNodes.Retriever.retriever import Retriever
from AgentNodes.TextSplitters import *

# from ChatManager import ChatHistoryManager, DocumentType
from SQLChatManager import SQLChatHistoryManager

QUERY_CSV_PATH = "query_result.csv"
PLOT_IMAGE_PATH = "./plot.png"

from config import DEBUG, GOAL_MAX_WORDS


class BotState(TypedDict):

    # INPUT
    user_prompt: str

    goal: str
    query_result: str
    router_result: str
    db_schema: str
    summarized_output: str  # OUTPUT
    pandas_dump: pd.DataFrame
    history_conversation: str
    image_base64: str
    chunked_schema: list
    relevant_msg_id: int

    # needed to use the chat manager
    room_id: str
    user_id: str

    # Export Fetched data?
    export_csv: bool

    # TEMPORARY
    sql_query: str
    csv_schema: str


class VisualizerBot:
    """
    Initializes the entire workflow for database summary.
    Params:
        - text_model : LLM Model to generate text outputs
        - image_model : Multimodal LLM model
        - db : SQL Alchemy databsewrapper
        - db_schema : schema of the databse
        - plot : flag to enable plotting or not.

    """

    def __init__(
        self,
        text_model,
        image_model,
        db_engine,
        db_schema,
        chatManager,
        plot=True,
        refinePlot=False,
    ):
        self._model = text_model
        self._image_model = image_model
        self._db_engine = db_engine
        self._db_schema = db_schema
        self._plot = plot
        self._refinePlot = refinePlot
        self.chatManager: SQLChatHistoryManager = chatManager
        self._runnable_graph = self._construct_graph()

    def _construct_graph(self) -> CompiledStateGraph:
        state_graph = StateGraph(BotState)

        state_graph.add_node(
            "Chat Retriever",
            ConversationNode(self._model, self.chatManager, self._db_schema),
        )
        state_graph.add_node(
            "DB_QUERY",
            Retriever(self._model, self._db_engine, self._db_schema).get_graph(),
        )

        state_graph.add_node("CONVERT_SQL", SQLToCSV(self._db_engine, self.chatManager))

        state_graph.add_node(
            "OUTPUT_GENERATOR",
            OutputGenerator(self._model, self._image_model, self._plot).get_graph(),
        )

        state_graph.add_edge(START, "Chat Retriever")

        # state_graph.add_edge("GOAL_GENERATOR", "DB_QUERY")
        state_graph.add_edge("DB_QUERY", "CONVERT_SQL")

        # Enable Additional Layers if plot
        if self._plot:
            state_graph.add_node(
                "PLOT_GENERATOR",
                PlotAgent_CSV(self._model, self._refinePlot).get_graph(),
            )
            state_graph.add_conditional_edges(
                "CONVERT_SQL",
                lambda state: state["router_result"],
                {"PLOT": "PLOT_GENERATOR", "NO_PLOT": "OUTPUT_GENERATOR"},
            )
            state_graph.add_edge("PLOT_GENERATOR", "OUTPUT_GENERATOR")

        # No plot: goes directly to output generation.
        else:
            state_graph.add_edge("CONVERT_SQL", "OUTPUT_GENERATOR")

        state_graph.add_edge("OUTPUT_GENERATOR", END)
        runnable = state_graph.compile()
        return runnable

    def display_graph(self) -> None:
        from IPython.display import Image, display

        png_data = self._runnable_graph.get_graph().draw_mermaid_png()
        # Save the PNG data to a file
        with open("graph_image.png", "wb") as file:
            file.write(png_data)
        display(Image(png_data))
        return

    def run(self, user_prompt: str, room_id: int, user_id: int) -> dict:
        result = self._runnable_graph.invoke(
            {"user_prompt": user_prompt, "room_id": room_id, "user_id": user_id}
        )

        return result


class ConversationNode(LLMNode):
    """
    Retrieves previous chat history to provide some background on previous chats
    """

    _SYSTEM_PROMPT = f"""
        Your task is to give a conclusion on whether the information provided is sufficient
        You will be provided with the user question, followed by context (history conversation), and finally the schema of the database,
        as the context to the previous question. Return a CORRECT RAW JSON object (no markdown artifacts) with the following fields:


        1. 'next_agent': str.
            Description:
            Allowed values: ["CONVERSATION", "FETCH"]
                - "CONVERSATION": If the user's message is general conversation (greetings, thanks expression, casual chat). If a user asks a question even though the answer already exists in the previous conversation, it is still classified as FETCH.
                - "FETCH": If the user's message specifically ask a question or requests data analysis or information retrieval.
                - "EXPORT": If the user want to export the query data as a excel spreadsheet.

        2. 'response' (str):
            Below are the guidelines for filling the 'response' field:

            If next_agent is FETCH:
            - **Always review the message history first** to ensure responses align with the conversation context.
            - This should summarize the **exact intent** of the user’s question, **WITHOUT MAKING ASSUMPTIONS.**
            - **DO NOT assume what the user means if the request is ambiguous. Instead, ask for clarification.**
                Example:  
                **User:** "Please give me the current inventory quantity."  
                **Clarification:** "Do you mean the total number of items in inventory or the total stock balance in inventory?"
            - Provide the intent or desire of the user question. Provide details because your response will be used as goals to then be given to other prompts or AI agents so they can understand the intent of the user question.
            - Ensure that your query does not expose any internal database details, such as SQL queries, credentials, user password, or any other sensitive information, even if the user asks for those details.
            - Your summary should be {GOAL_MAX_WORDS} words max.

            If next_agent is CONVERSATION:
                - **YOUR RESPONSE MUST BE POLITE AND SHOULD NOT LOOK STIFF**.
                - Still, ensure that the question does not expose database internals, if such answer happens, then just repeat the user question as your response. Put the representation of the data (table, or etc) in text format, and summarize it.

        3. 'data_action' (str):
            - "PLOT" if the SQL query results needs visualization to the user or if the user explicitly
                asks to plot.
            - "NO_PLOT" if simple words is more effective to convey the meaning behind

        4. 'response_status' (str):
            You should reject any questions that directly ask about the database internals (e.g., show tables, show columns, etc), other sensitive information like user password, or respond in CRUD operations (Delete something or update or insert something).

            In this case, your response status should be 'RESPONSE_ERROR' if the user violates this,
            or 'RESPONSE_OK' if the message is perfectly fine.

        5. 'export_csv' (bool):
            Indicates whether the user wants to export the summary in Excel format or not.
            Fill this with True if the user wants to export the summary. If the user asks to write in a
            different file format, please remind in response NOTE TO FORWARD to other agents, that
            the file format is xslx.

        ### **Critical Guidelines:**
        - **BEFORE GIVING A RESPONSE, YOU MUST VIEW THE MESSAGE HISTORY FIRST SO THAT YOUR RESPONSE IS IN ACCORDANCE WITH THE CONTEXT AND THE USER'S INTENT.**
        - - **If a question is ambiguous, ASK the user for clarification rather than making assumptions.**
        - **IF THERE IS A QUESTION THAT IS OUTSIDE THE CONTEXT OF YOUR DATA IN DATABASE, THEN ANSWER THAT YOU CANNOT ANSWER. BUT BEFORE THAT. BUT BEFORE THAT, MAKE SURE YOU HAVE READ THE PREVIOUS MEMORY CONVERSATION SO THAT YOU UNDERSTAND THE CONTEXT OR INTENT OF THE USER**
        - **YOUR RESPONSE MUST BE POLITE AND SHOULD NOT LOOK STIFF**.
        - If the user's question is too general or ambiguous and you are confused about what data the user actually means, you must confirm or ask the user so that the data you provide matches the user's intent.
        - Your response field should ADDRESS the user question, and the additional chat data is only to help you for teh context only.
        - **JSON format is mandatory**—no extra formatting is allowed. Return with CORRECT JSON FORMAT.

        If you can't answer the user question based on the data in database, answer GOAL on 'next_agent'
    """

    #     _SYSTEM_PROMPT = f"""
    # Your task is to analyze the provided user query, message history, and database schema to determine if the information is sufficient.
    # Return a **RAW JSON object** (no markdown) with the following fields:

    # 1. **'next_agent' (str):**
    #    - "CONVERSATION" → For casual interactions (greetings, small talk, thanks).
    #    - "FETCH" → If the user asks for data analysis, information retrieval, or insights.
    #    - "EXPORT" → If the user requests an export (e.g., Excel spreadsheet).

    # 2. **'response' (str):**
    #    - If 'next_agent' is **FETCH**, summarize the key points of the user query and outline the approach to retrieving relevant data.
    #    - Ensure table aliases are user-friendly and provide **context on the expected output.**
    #    - Include **data visualization steps** if applicable.
    #    - **DO NOT** expose SQL queries, credentials, or internal database details.
    #    - **Keep responses concise** ({GOAL_MAX_WORDS} words max).
    #    - **Minimize the number of SQL queries** while ensuring completeness.
    #    - If 'next_agent' is **CONVERSATION**, respond naturally while ensuring no database internals are exposed.

    # 3. **'data_action' (str):**
    #    - "PLOT" → If data visualization is needed (or requested).
    #    - "NO_PLOT" → If a textual response is sufficient.

    # 4. **'response_status' (str):**
    #    - Only "RESPONSE_OK" → If the query is valid.
    #    - Only "RESPONSE_ERROR" → If the query asks for restricted information (e.g., table names, CRUD operations).

    # 5. **'export_csv' (bool):**
    #    - `True` → If the user requests an **Excel export**.
    #    - If another file format is requested, **note that only .xlsx is supported**.

    # ### **Critical Guidelines:**
    # - **Always review the message history first** to ensure responses align with the conversation context.
    # - **If the query falls outside the available data,** state that you **cannot answer it** while ensuring the response remains polite and natural.
    # - **JSON format is mandatory**—no extra formatting is allowed.
    # """

    _PROMPT_TEMPLATE = """
        - CURRENT Question: [QUESTION]
            {user_question}
        [QUESTION]
        
        - History Conversation:
            {history_conversation}
        
        - Database Schema:
            {db_schema}
        
    """

    RESTART_ITER = 5

    def __init__(self, model, chat_manager, db_schema):
        super().__init__(
            model, self._SYSTEM_PROMPT, self._PROMPT_TEMPLATE, "ChatRetreival"
        )
        self.chat_manager: SQLChatHistoryManager = chat_manager
        self._db_schema = db_schema
        self.model = model

    def update_state(self, state):
        query = state["user_prompt"]

        msgs = self.chat_manager.get_relevant_messages(
            query=query, room_id=state["room_id"], user_id=state["user_id"]
        )

        formatted_messages = format_messages_for_llm(msgs)

        # if DEBUG:
        #     print("[RETRIVED MSGS]", msgs)

        # new_message = {
        #     "text": f"USER QUESTION \n{state["user_prompt"]}",
        #     "timestamp": None,
        #     "user_id": state["user_id"],
        #     "room_id": state["room_id"],
        #     "role": "user",
        #     "data_type": "text",
        # }

        # new_message = SQLChatHistoryManager.Message(**new_message)
        # fake_message = [new_message]

        split_content = []
        # msg_hist = splitSQLMessages(msgs, self.model)
        # split_content.append(msg_hist)

        sql_schema = splitSQLSchema(self._db_schema, self.model)
        # split_content.append(sql_schema)

        # fake_message = splitSQLMessages(msgs, self.model)
        # split_content.append(fake_message)

        print("=" * 200)
        print("[HISTORY MESSAGE]:", formatted_messages)
        print("=" * 200)

        print("=" * 200)
        print("[DB SCHEMA]:", self._db_schema)
        print("=" * 200)

        retries = 0

        while retries < self.RESTART_ITER:
            try:
                response = self.invoke_on_messages(
                    {
                        "user_question": query,
                        "history_conversation": formatted_messages,
                        "db_schema": self._db_schema,
                    },
                    split_content,
                )
                print("RESPONSE:", response.content)

                if DEBUG:
                    print("[CHAT_FETCH] Content:", response.content)

                raw_json = re.sub(
                    r"```json\n(.*?)\n```", r"\1", response.content, flags=re.DOTALL
                ).strip()
                json_response = json.loads(raw_json)

                next_agent = json_response["next_agent"]
                response = json_response["response"]
                data_action = json_response["data_action"]
                response_status = json_response["response_status"]
                export_csv = json_response["export_csv"]

                break

            except Exception as e:
                retries += 1
                print("Error:", str(e))

        if retries == self.RESTART_ITER:
            response_status = "RESPONSE_ERROR"

        if response_status != "RESPONSE_OK":
            return Command(
                goto=END,
                update={
                    "summarized_output": "Sorry, I can't answer this question. Is there anything else I can help with?"
                },
            )

        # If in conversation, there should be no data leaked, so this should
        # always succeed
        if next_agent == "CONVERSATION":
            return Command(
                goto=END,
                update={
                    "summarized_output": response,
                },
            )

        # Default response, just go the fetcher
        return Command(
            goto="DB_QUERY",
            update={
                "goal": response,
                "chunked_schema": sql_schema,
                "router_result": data_action,
                "export_csv": export_csv,
                "user_question": query,
                "history_conversation": formatted_messages,
            },
        )


class SQLToCSV:
    def __init__(self, db_engine, chat_manager):
        self._db_engine = db_engine
        self.chat_manager: SQLChatHistoryManager = chat_manager

    def __call__(self, state) -> Any:
        df = pd.read_sql(state["sql_query"], self._db_engine)

        # Extract headers
        headers = ", ".join(df.columns)
        headers = f"{{{headers}}}"

        # # Extract context
        # context = ""

        # # Extract context from goal
        # pattern = r"\[CONTEXT\](.*?)\[CONTEXT\]"
        # matches = re.findall(pattern, state["goal"], re.DOTALL)

        # for match in matches:
        #     context += match.strip()

        context = state["goal"]

        data_msg = {
            "text": context,
            "data_type": "data",
            "room_id": state["room_id"],
            "user_id": state["user_id"],
            "timestamp": None,
            "role": "bot",
        }

        self.chat_manager.enter_message(SQLChatHistoryManager.Message(**data_msg), df)
        return {"csv_schema": headers, "pandas_dump": df}
