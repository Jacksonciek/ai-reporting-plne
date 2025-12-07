# import os
# import sys
# import shutil

# from tests.RetrieverTest.test_utils import run_retriever 
# from tests.RetrieverTest.test_utils import install_db 
# from AgentNodes.Retriever.retriever import Retriever 
# from langchain_openai import ChatOpenAI
# from langchain_community.utilities import SQLDatabase

# from dotenv import load_dotenv
# load_dotenv()

# import unittest
# class TestPlotter(unittest.TestCase):
#     def test_graph_arch(self):
#         from IPython.display import Image, display
#         print("Testing Graph Architecture")

#         db = SQLDatabase.from_uri("sqlite:///Chinook.db")
#         agent = Retriever(ChatOpenAI(), db)
#         png_data = agent.get_graph().get_graph().draw_mermaid_png()
#         # Save the PNG data to a file
#         with open("graph_image.png", "wb") as file:
#             file.write(png_data)
#         display(Image(png_data))

#         self.assertTrue(True)

#     def test_toy_1(self):
#         print("TEST TOY_QUERY 1")
#         run_retriever(workdir="./result/test1/", 
#                             user_prompt='''Get Albums with More Than 20 Tracks, and display the number of tracks for each album''')

#         self.assertTrue(True)

#     # def test_toy_2(self):
#     #     print("TEST TOY_QUERY 1")
#     #     run_retriever(workdir="./result/test1/", 
#     #                         user_prompt='''Get Albums with More Than 20 Tracks, and display the number of tracks for each album''')

#     #     self.assertTrue(True)

# if __name__ == "__main__": 
    
#     install_db()
#     print("Current Directory:", os.getcwd())
#     print(os.path.exists("./result/test1"))
#     unittest.main()
