import os
import shutil
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
from typing_extensions import TypedDict
from AgentNodes.Plotter.plot_agent_csv import PlotAgent_CSV

from langchain_openai import ChatOpenAI
model = ChatOpenAI()

class InputParams(TypedDict):
    goal: str 
    json_schema: str
    filename: str

def run_plot_generator(workdir: str, user_prompt: str, 
                        json_schema: str, file_path: str) -> None:

    os.makedirs(workdir, exist_ok=True)
    
    # extract file name.
    filename = os.path.basename(file_path)  

    # copy file to workdir
    shutil.copy2(file_path, os.path.join(workdir, filename))

    os.chdir(workdir)
    input_params = InputParams(goal=user_prompt, json_schema=json_schema,
                                filename=filename)
    
    plotter = PlotAgent_CSV(model).get_graph()
    plotter.invoke(input_params)

    img = mpimg.imread('./plot.png')
    plt.imshow(img)
    plt.axis('off')  # Hide axes
    plt.show()

    return
