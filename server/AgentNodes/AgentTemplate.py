from abc import ABC, abstractmethod
from langgraph.graph import StateGraph
from langgraph.graph.state import CompiledStateGraph
from typing_extensions import TypedDict

class AgentTemplate():
    '''Template for agent subgraphs in the data inferrence system'''
    
    def __init__(self, model, state):
        pre_compiled_graph = StateGraph(state)
        self.build_graph(pre_compiled_graph, model)
        self._graph = pre_compiled_graph.compile()

    def get_graph(self) -> CompiledStateGraph:
        return self._graph
    
    @abstractmethod
    def build_graph(self, stateGraph: StateGraph, model) -> None:
        pass
    