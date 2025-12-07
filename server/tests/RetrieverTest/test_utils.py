import os
import shutil
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import pandas as pd
from typing_extensions import TypedDict
from AgentNodes.Retriever.retriever import Retriever 
from langchain_community.utilities import SQLDatabase

from langchain_openai import ChatOpenAI
model = ChatOpenAI()

def install_db():
    import requests

    url = "https://storage.googleapis.com/benchmarks-artifacts/chinook/Chinook.db"

    response = requests.get(url)

    if response.status_code == 200:
        # Open a local file in binary write mode
        with open("Chinook.db", "wb") as file:
            # Write the content of the response (the file) to the local file
            file.write(response.content)
        print("File downloaded and saved as Chinook.db")
    else:
        print(f"Failed to download the file. Status code: {response.status_code}")


class InputParams(TypedDict):
    goal: str 

def run_retriever(workdir: str, user_prompt: str, ) -> None:

    # Initialize database
    db = SQLDatabase.from_uri("sqlite:///Chinook.db")

    os.makedirs(workdir, exist_ok=True)

    os.chdir(workdir)
    input_params = InputParams(goal=user_prompt)
    
    retriever = Retriever(model, db).get_graph()
    result = retriever.invoke(input_params)

    print("\nAgent Result:")
    print(result["output"])

    df = pd.read_sql(result["sql_query"], db._engine)
    df.to_csv("./query_llm_result.csv")
    return
