# import os
# import shutil
# import sys

# from dotenv import load_dotenv
# from langchain_openai import ChatOpenAI

# from AgentNodes.Plotter.plot_agent_csv import PlotAgent_CSV
# from tests.PlotterTest.test_utils import run_plot_generator

# load_dotenv()

# import unittest


# class TestPlotter(unittest.TestCase):
#     def test_graph_arch(self):
#         from IPython.display import Image, display

#         print("Testing Graph Architecture")

#         agent = PlotAgent_CSV(ChatOpenAI())
#         png_data = agent.get_graph().get_graph().draw_mermaid_png()
#         # Save the PNG data to a file
#         with open("graph_image.png", "wb") as file:
#             file.write(png_data)
#         display(Image(png_data))

#         self.assertTrue(True)

#     def test_toy_1(self):
#         print("TEST toy_plot_1")
#         run_plot_generator(
#             workdir="./result/test1/",
#             user_prompt="""Create a plot of the positions of the two objects vs. time contained in ToyData1.csv, with a scatter plot.""",
#             json_schema="{csv_columns: ['Time', 'Position A', 'Position B']}",
#             file_path="./data/ToyData1.csv",
#         )

#         self.assertTrue(True)


# if __name__ == "__main__":
#     print("Current Directory:", os.getcwd())
#     print(os.path.exists("./result/test1"))
#     unittest.main()
