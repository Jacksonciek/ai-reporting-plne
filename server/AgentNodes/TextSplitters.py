import json
import re
import typing

import pandas as pd
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate

# from ChatManager import ChatHistoryManager
from SQLChatManager import SQLChatHistoryManager

"""
    Split SQL Schema into a list of Langchain messages,
    according to a model's tokenizer.
"""


def splitSQLSchema(schema: str, model) -> ChatMessageHistory:

    hist = ChatMessageHistory()

    pattern = r"(CREATE TABLE.*?)(?=CREATE TABLE|$)"
    tableList = re.findall(pattern, schema, re.DOTALL)

    num_tables = len(tableList)
    cur_table = 0
    chunk_number = 0

    if not model.max_tokens:
        max_tokens = 4096
    else:
        max_tokens = model.max_tokens

    hist.add_user_message(
        """The schema would be sent in several chunks, 
                            and the schema entirely sent when I say
                            "ALL CHUNKS SENT" """
    )

    while cur_table < num_tables:
        total_token = 0
        msg_chunk = f"Chunk {chunk_number}"

        while cur_table < num_tables and total_token < max_tokens:
            msg_chunk += tableList[cur_table] + "\n"
            total_token += model.get_num_tokens(tableList[cur_table])
            cur_table += 1

        hist.add_user_message(msg_chunk)
        hist.add_ai_message(f"Chunk {chunk_number} sent")
        chunk_number += 1

    hist.add_user_message("ALL CHUNKS SENT")

    return hist.messages


"""
    Split the dataframe into a list of Langchain messages,
    according to a model's tokenizer.
"""


def splitPandas(
    df: pd.DataFrame, model, batch_size=100, max_rows=None
) -> ChatMessageHistory:

    hist = ChatMessageHistory()

    row = 0
    chunk_number = 0

    if not max_rows:
        max_rows = df.shape[0]
    else:
        max_rows = min(df.shape[0], max_rows)

    if not model.max_tokens:
        max_tokens = 4096
    else:
        max_tokens = model.max_tokens

    # First message
    hist.add_user_message(
        """
                            You will read a pandas dataframe.
                            The pandas data would be sent in batches, with the first
                            row being the names of the columns in the dataframe """
    )

    # Chunk the csv response
    while row < max_rows:
        total_token = 0
        msg_chunk = f"Chunk {chunk_number}\n"

        while total_token < max_tokens and row < max_rows:
            msg_chunk = df.iloc[row : min(max_rows, row + batch_size)].to_string()
            msg_chunk += "\n Next batch: \n"
            total_token += model.get_num_tokens(msg_chunk)
            row += batch_size

        # print(msg_chunk)
        hist.add_user_message(msg_chunk)
        hist.add_ai_message(f"Chunk {chunk_number} sent\n")
        chunk_number += 1

    hist.add_user_message("ALL CHUNKS SENT")
    return hist.messages


# Split Message Docs into Langchain ChatMessage
# def splitMessages(msg_docs : list[Document], chatManager: ChatHistoryManager, model) -> list[BaseMessage]:

#     hist = []
#     for doc in msg_docs:
#         # Check type of message, if image, do special treatment

#         metadata = doc.metadata
#         msg_text = doc.page_content
#         msg_uid = doc.metadata['uid']
#         if (metadata['type'] == 'image'):
#             new_message = [HumanMessage(
#                 content= [
#                     {'type': 'text', 'text': f"type:image\n{msg_uid}\n{msg_text}"},
#                     {'type': 'image_url', 'image_url': {"url": "data:image/jpeg;base64, {msg_text}"}}
#                 ]
#             )]

#             hist.extend(new_message)

#         elif (metadata['type'] == 'data'):
#             new_message = [HumanMessage(
#                 content= [
#                     {'type': 'text', 'text': f"type:data\nuid:{msg_uid}\n{msg_text}"}
#                 ]
#             )]

#             hist.extend(new_message)

#             # Get Pandas dataframe
#             pd_uid = metadata['df_uid']
#             df = chatManager.get_dataframe(pd_uid)

#             hist.extend(splitPandas(df, model))

#         else:
#             new_message = [HumanMessage(
#                 content= [
#                     {'type': 'text', 'text': f"type:text\n{msg_uid}\n{msg_text}"}
#                 ]
#             )]

#             hist.extend(new_message)

#     return hist


def splitSQLMessages(
    messages: list[SQLChatHistoryManager.Message], model
) -> list[BaseMessage]:

    hist = []
    for message in reversed(messages):
        # Check type of message, if image, do special treatment
        if message.data_type == "image":
            new_message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": f"type:image\n{message.id}\n{message.text}",
                    },
                    {"type": "image_url", "image_url": {"url": f"{message.text}"}},
                ]
            )

            hist.append(new_message)

        elif message.data_type == "data":
            new_message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": f"type:data\nuid:{message.id}\n{message.text}",
                    }
                ]
            )

            hist.append(new_message)

            # # Get Pandas dataframe
            # df = SQLChatHistoryManager.get_dataframe(message)
            # if df is not None:
            #     hist.extend(splitPandas(df, model))

        else:
            new_message = [
                HumanMessage(
                    content=[
                        {
                            "type": "text",
                            "text": f"type:text\n{message.id}\n{message.text}",
                        }
                    ]
                )
            ]

            hist.extend(new_message)

    return hist


def format_messages_for_llm(messages: list[SQLChatHistoryManager.Message]) -> str:
    """
    Convert chat history from the database into a readable format for LLM.
    Ensures messages are in ascending order (oldest to newest).

    Expected output format:
    User: <user message>
    Bot: <bot message>
    """

    formatted_history = []

    for message in messages:
        if message.role == "user":
            formatted_history.append(f"User: {message.text}")
        elif message.role == "bot":
            formatted_history.append(f"Bot: {message.text}")
        elif message.data_type == "image":
            formatted_history.append(
                f"Bot: [Image] {message.text} (URL: {message.image_url})"
            )
        elif message.data_type == "data":
            formatted_history.append(f"Bot: [Data] {message.text}")
        elif message.data_type == "document":
            formatted_history.append(
                f"Bot: [Document] {message.text} (URL: {message.document_url})"
            )

    return "\n".join(formatted_history)


# def splitSQLMessages(messages: list[SQLChatHistoryManager.Message], model) -> str:
#     """
#     Format message history into a structured conversation for better AI understanding.
#     """
#     formatted_history = []

#     for message in reversed(messages):  # Reverse to maintain chronological order
#         if message.role == "user":
#             formatted_history.append(f"User: {message.text}")
#         elif message.role == "bot":
#             formatted_history.append(f"Bot: {message.text}")
#         elif message.data_type == "image":
#             formatted_history.append(
#                 f"Bot: [Image] {message.text} (URL: {message.text})"
#             )
#         elif message.data_type == "data":
#             formatted_history.append(f"Bot: [Data] {message.text}")

#     return "\n".join(formatted_history)
