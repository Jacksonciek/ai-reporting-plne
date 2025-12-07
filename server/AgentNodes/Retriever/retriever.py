import re
import time
from typing import Literal

import pandas as pd
import sqlalchemy
from langchain_community.utilities.sql_database import SQLDatabase
from langgraph.graph import END, START, StateGraph
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from typing_extensions import TypedDict

from AgentNodes.AgentTemplate import AgentTemplate
from AgentNodes.LLMNode import LLMNode
from AgentNodes.TextSplitters import splitSQLSchema
from config import DEBUG


class RetrieverState(TypedDict):
    """Internal state representation for the SQLRetriever Agent"""

    #!INPUT
    goal: str
    user_prompt: str

    temp_output: str  # Temporary execution output
    current_iter: int  # Current loop iteration
    error_log: str  # SQL Error Log
    chunked_schema: list
    history_conversation: str

    #!OUTPUT
    sql_query: str
    pandas_dump: pd.DataFrame


class Retriever(AgentTemplate):
    MAX_NUM_ITER = 5

    # TEMPORARY
    if DEBUG:
        start_time = 0

    def __init__(self, model, sql_db_engine, db_schema):
        self._sql_db_engine = sql_db_engine
        self._db_schema = db_schema
        super().__init__(model, RetrieverState)

    # * OVERRIDE
    def build_graph(self, stateGraph: StateGraph, model) -> None:
        stateGraph.add_node("init_state", initialize_state)
        stateGraph.add_node(
            "query_gen",
            QueryGenerator(model, self._sql_db_engine, self._db_schema, "SQL_GEN"),
        )
        stateGraph.add_node("execute_query", SQL_Executor(self._sql_db_engine))
        stateGraph.add_edge(START, "init_state")
        stateGraph.add_edge("init_state", "query_gen")
        stateGraph.add_edge("query_gen", "execute_query")
        stateGraph.add_conditional_edges("execute_query", check_query)


class QueryGenerator(LLMNode):
    """Transforms user query to an SQL query"""

    # SYSTEM_TEMPLATE = """
    #     Please guidelines below:
    #     - You are a SQL expert with a strong attention to detail.
    #     - Given an input question and database schema, output a syntactically correct mySQL query to run, then look at the results of the query and return the answer.
    #     - You might also receive a SQL code snippet, and an error associated with it. If there are any errors, fix the code that is given.
    #     - DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.
    #     - DO NOT MAKE QUERY TO ALTER OR MODIFY DATA.
    #     - You can order the results by a relevant column to return the most interesting examples in the database.
    #     - Never query for all the columns from a specific table, only ask for the relevant columns given the question.
    #     - You will also respond in SQL only, specifically, the {dialect} dialect.
    #     - You should also try replacing numerical keys for entities with more representative information (like names) should
    #     you join two tables.
    #     - Your database is MySQL.
    #     - **DO NOT rename columns** in the query. If an alias (`AS`) is used, it **must be the same as the original column name**.
    #         **Example:**
    #         **Correct:** `SELECT SUM(stock_balance) AS stock_balance FROM inventories;`
    #         **Incorrect:** `SELECT SUM(stock_balance) AS total_items FROM inventories;`

    #     **YOU ONLY MAKE 1 QUERY STATEMENT IN YOUR RESPONSE.**
    # """

    SYSTEM_TEMPLATE = """
You are a MySQL expert with strong attention to detail. Your primary task is to generate a **correct and precise SQL query** based on the user's request and the provided database schema.

### **General Query Guidelines:**
1. **Query Scope & Integrity:**
   - Generate **only SELECT queries**. **DO NOT** perform any DML (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE).
   - Ensure the query retrieves **only the necessary columns** relevant to the user's request.
   - If an alias (`AS`) is used, **it must be identical to the original column name** (NO renaming or modifying column names).
   - The response must contain **only one SQL statement**.

2. **Understanding User Intent & Preventing Assumptions:**
   - Always analyze the **full context** of the user question.
   - **DO NOT make assumptions** about ambiguous terms; instead:
     - If the question is **clear and specific**, directly generate the query.
     - If the intent is **ambiguous**, structure the query to provide **all relevant data** so the system can clarify with the user.
   - If the user **modifies or refines their question**, ensure the new query **aligns with the correction** rather than relying on previous assumptions.

3. **Handling Ambiguity in Data Requests:**
   - When users request a **total count** of something, retrieve the **count of unique records** (`COUNT(id)`).
   - When users request a **sum of values**, use the **correct aggregate function** (`SUM(column_name)`).
   - If a term can have **multiple interpretations**, retrieve **all possible relevant data** in a single query.

4. **Error Handling & Debugging Assistance:**
   - If given a SQL snippet with an error, fix the query and return the corrected version.
   - If the query requires optimization, improve it while maintaining correctness.
   - Always follow **MySQL best practices** to ensure efficient queries.

5. **Consistency with Schema:**
   - Use **only the column names and table structures** provided in the schema.
   - **Do not assume or invent column names**; if a column name is unclear, return a note requesting clarification.

### **Critical Guidelines:**
    - **BEFORE GIVING SQL QUERY RESPONSE, YOU MUST VIEW THE MESSAGE HISTORY FIRST SO THAT YOUR RESPONSE IS IN ACCORDANCE WITH THE CONTEXT AND THE USER'S INTENT.**

Your database is MySQL. Follow the above rules strictly to ensure accurate and efficient queries.
"""

    USER_TEMPLATE = """

    User question:
        {user_prompt}
    
    The following is an explanation of information about the intent of the user's question (goal):
        {goal}

    Generated Code: 
        {sql_query}

    Error: 
        {error_log}
    
    History conversation (Previous Conversation):
        {history_conversation}

    The schema of the database would be sent in chunks, do not reply until all chunks
    are sent.
    """

    def __init__(self, model, sql_db_engine, db_schema, name=None):
        self._sql_db_engine = sql_db_engine
        self._db_schema = db_schema
        super().__init__(model, self.SYSTEM_TEMPLATE, self.USER_TEMPLATE, name)

    # * OVERRIDE
    def update_state(self, state) -> dict:

        # Retrieve LLM output
        llm_input = state

        # Set the input args to the template
        llm_input["dialect"] = self._sql_db_engine.dialect.name
        tables = state["chunked_schema"]

        template_params = {
            "user_prompt": state["user_prompt"],
            "goal": state["goal"],
            "sql_query": state["sql_query"],
            "error_log": state["error_log"],
            "dialect": state["dialect"],
            "history_conversation": state["history_conversation"],
        }

        # Split the schema into chunks
        raw_input = self.invoke_on_messages(template_params, [tables]).content

        # Input cleanup
        pattern = re.compile(r"```sql\s*([\s\S]+?)\s*```", re.MULTILINE)
        code_blocks = pattern.findall(raw_input)
        sql_query = "\n".join(code_blocks)

        if DEBUG:
            print("=" * 40)
            print("[SQL_QUERY] Output: \n" + sql_query)
            print("=" * 40)

        print("SQL QUERY: ", sql_query)

        return {"sql_query": sql_query}


class SQL_Executor:
    def __init__(self, sql_db_engine: sqlalchemy.Engine):
        self._sql_db_engine = sql_db_engine

    def __call__(self, state):

        if DEBUG:
            start_time = time.time()

        update = {"current_iter": state["current_iter"] + 1}
        statements = state["sql_query"].strip().split(";")

        with self._sql_db_engine.connect() as connection:
            result = []
            for i, statement in enumerate(statements, start=1):
                statement = statement.strip()  # Remove leading/trailing whitespace

                if bool(statement.strip()):  # Only execute non-empty statements
                    try:
                        result = connection.execute(text(statement))

                        update["pandas_dump"] = pd.DataFrame(
                            result.all(), columns=result.keys()
                        )

                        update["sql_query"] = state["sql_query"]
                        # Success
                        update["error_log"] = ""

                    # Check for errors.
                    except SQLAlchemyError as e:
                        err = ""
                        err += f"SQLAlchemyError on statement {i}: {statement}\n"
                        err += f"Error details: {e}\n"
                        update["error_log"] = err
                        update["pandas_dump"] = None
                        update["sql_query"] = None

                        return update

        if DEBUG:
            print("[SQL] Retrieved Data:")
            print(update["pandas_dump"])

            print(f"[SQL] Time spent on executing: {time.time() - start_time} s")

        print("SQL RESULT: ", update["pandas_dump"])
        return update


def initialize_state(state: RetrieverState):
    valid_input = len(state["goal"]) != 0

    if DEBUG:
        Retriever.start_time = time.time()

    if not valid_input:

        raise ValueError(
            "Invalid input for the agent.\n User prompt should not be empty"
        )
    return {"current_iter": 0, "error_log": "", "sql_query": "", "pandas_dump": None}


def check_query(state: RetrieverState) -> Literal["query_gen", END]:
    if state["current_iter"] >= Retriever.MAX_NUM_ITER or len(state["error_log"]) == 0:
        return END
    return "query_gen"
