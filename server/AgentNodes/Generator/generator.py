import base64
import os
import re
import time

import pandas as pd
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from AgentNodes.AgentTemplate import AgentTemplate
from AgentNodes.LLMNode import LLMNode
from AgentNodes.TextSplitters import splitPandas
from config import DEBUG


class GeneratorState(TypedDict):
    summarized_output: str  # OUTPUT
    router_result: str
    goal: str
    user_prompt: str
    pandas_dump: pd.DataFrame
    image_base64: str
    sql_query: str


class OutputGenerator(AgentTemplate):
    """
    Generates output based on the SQL Query given and
    explains the trend present within the plot.

    Input:
        - pandas data
        - refined user prompt
        - router result

    Output:
        - summarized_output: Explanation that answers the specific user query.
    """

    if DEBUG:
        start_time = 0

    def __init__(self, model, image_model, plot=True):
        self._image_model = image_model
        self._plot = plot
        super().__init__(model, GeneratorState)

    def build_graph(self, stateGraph: StateGraph, model) -> None:
        stateGraph.add_node("text_summary", SimpleSummarizerNode(model))
        stateGraph.add_edge("text_summary", "EXPORT")
        stateGraph.add_node("EXPORT", export)
        stateGraph.add_edge("EXPORT", END)

        if self._plot:
            stateGraph.add_node("image_summary", ImageSummarizerNode(self._image_model))
            stateGraph.add_conditional_edges(
                START,
                lambda state: state["router_result"],
                {"PLOT": "image_summary", "NO_PLOT": "text_summary"},
            )
            stateGraph.add_edge("image_summary", "EXPORT")
        else:
            stateGraph.add_edge(START, "text_summary")


# NODES
class SimpleSummarizerNode(LLMNode):

    #     _SYSTEM_PROMPT = """

    #         You are an AI assistant tasked with analyzing data from a textual format and answering user questions based on the data and context given.

    #         Guidelines:
    #         - The context of the data is an important cue on how to answer the user.
    #         - The first row represents the column headers; all subsequent rows contain the data.
    #         - If any internal database information (e.g., SQL queries, database credentials or any sensitive information like user password) is encountered, ignore it entirely and exclude it from your response for security reasons.
    #         - Ensure that your output only includes information explicitly found in the data.
    #         - If there are no data, consider the context given, and otherwise if the data does not represent the context, answer that there are no such data.

    #         **Answer in INDONESIAN.**

    # """

    _SYSTEM_PROMPT = """
You are an AI assistant that analyzes data and provides answers based on the given context.

### **Guidelines:**
- **Always use the provided context** to accurately interpret user questions and data.
- **Do not assume information beyond what is explicitly provided in the data.**
- **Ensure that the response clearly states what the data represents, using the correct terminology.**
- **The first row contains column headers, and all subsequent rows contain data. Use the column header to describe the data correctly.**
- **If the data does not match the user's question, clarify this instead of making assumptions.**
- **If any internal database information (e.g., SQL queries, database credentials or any sensitive information like user password) is encountered, ignore it entirely and exclude it from your response for security reasons.**
- **Answer in INDONESIAN.**

### **Response Formatting:**
- **Always specify what the given data represents.**
- **Use the exact column name meaning from the database to describe the value.**
- **If the data does not directly answer the user’s request, provide clarification.**

### **Example Responses:**
**Correct Response (if the data represents stock balance, not total inventory count):**  
*"Jumlah total saldo stok dalam inventaris adalah **1.847.853,467**."*  

**Incorrect Response (misleading user by saying total inventory):**  
*"Jumlah inventory saat ini adalah 1,847,853.467 unit."* _(Wrong because it implies total inventory count rather than stock balance)_  

### **If Data is Not Relevant:**
If the data does not match the user’s intent, clarify it:
*"Data yang diberikan hanya menunjukkan saldo stok, bukan jumlah total barang dalam inventaris. Jika Anda memerlukan informasi lebih rinci, silakan periksa kembali data yang tersedia."*

 **Answer in INDONESIAN.**

"""

    # _SYSTEM_PROMPT = """
    #     You are a data summarizer. Your task is to analyze data from a CSV file and answer the user's question based solely on the provided CSV data. Use only the information from the CSV to respond.

    #     Note:
    #     - The first row contains the column names; subsequent rows contain the data.
    #     - For security reasons, the output you provide should not contain or mention information about database internals such as table names, SQL queries, database credentials, etc.
    # """
    # - If the CSV data does not contain enough information to answer, respond with "I cannot answer the question."
    # - Respond in the same language as the user question.
    # - Answer without mentioning any internal details regarding the database (i.e. table names)

    _MAX_ROWS = 4096

    _USER_TEMPLATE = """
        User Question:
        {question} 
        
        Here is an SQL query to get Pandas results or relevant data that is only used by you as additional information and should not be included in your response. SQL Query:
        {sql_query}
        

        The following is an explanation of information about the intent of the user's question (goal): 
        {context}  
        
        The data will be sent in several chunks, don't submit you final answer until all chunks are processed
        ("ALL CHUNKS SENT").
        
        NOTE:
        **THE DATA SENT TO YOU IS DATA THAT IS RELEVANT AND APPROPRIATE TO ANSWER USER QUESTIONS**
    """

    def __init__(self, model):
        super().__init__(model, self._SYSTEM_PROMPT, self._USER_TEMPLATE)

    def update_state(self, state) -> dict:

        # context = ""
        # # Extract context from goal
        # pattern = r"\[CONTEXT\](.*?)\[CONTEXT\]"
        # matches = re.findall(pattern, state["goal"], re.DOTALL)

        # for match in matches:
        #     context += match.strip()

        context = state["goal"]

        template_params = {
            "question": state["user_prompt"],
            "sql_query": state["sql_query"],
            "context": context,
        }

        if DEBUG:
            OutputGenerator.start_time = time.time()
            print("CONTEXT :", context)

        # Split pandas data in chunks
        if state["pandas_dump"] is not None:
            dataChunks = splitPandas(
                state["pandas_dump"], self.model, max_rows=self._MAX_ROWS
            )

            response = self.invoke_on_messages(template_params, [dataChunks]).content
        else:
            response = self.invoke_llm(template_params).content

        return {"summarized_output": response}


class ImageSummarizerNode:
    _SYSTEM_MESSAGE = """
        Given an chart based on a database query, summarize what the chart is trying to convey
        and based on the information, answer the user query.

        Also, you will be given data to support your reasoning, and the data will be sent
        in chunks. Do not submit a final answer until all chunks are sent.

        **Answer in INDONESIAN.**
    """

    def __init__(self, multi_modal_model):
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", self._SYSTEM_MESSAGE),
                (
                    "user",
                    [
                        {
                            "type": "text",
                            "text": """
                                    Question:
                                    {user_question}

                                    Context:
                                    {goal}
                                """,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/jpeg;base64, {image_data}"
                            },
                        },
                    ],
                ),
            ]
        )

        self._chain = prompt | multi_modal_model

    def __call__(self, state):

        if DEBUG:
            OutputGenerator.start_time = time.time()

        # fill in params
        template_params = {
            "image_data": state["image_base64"],
            "user_question": state["user_prompt"],
            "goal": state["goal"],
        }
        response = self._chain.invoke(template_params).content

        # invoke internal chain to get response
        return {"summarized_output": response}


def export(state):
    if DEBUG:
        print(
            f"TIME ELAPSED DURING GENERATING: {time.time() - OutputGenerator.start_time} (in generator)"
        )
    pass
