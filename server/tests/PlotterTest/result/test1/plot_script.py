import pandas as pd
import matplotlib.pyplot as plt

def generate_fig():
    data = pd.read_csv('ToyData1.csv')

    time = data['Time']
    position_A = data['Position A']
    position_B = data['Position B']

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.scatter(time, position_A, label='Position A', color='blue')
    ax.scatter(time, position_B, label='Position B', color='red')

    ax.set_xlabel('Time')
    ax.set_ylabel('Position')
    ax.set_title('Positions of Objects A and B vs. Time')
    ax.legend()

    return fig

fig = generate_fig() 
fig.savefig('./plot.png')