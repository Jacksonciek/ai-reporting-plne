import time
from abc import ABC, abstractmethod

from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate

from config import DEBUG

"""
    Various class definitions 
"""


class LLMNode:
    """
    Abstract base class for a LLM langgraph Node.

    The LLM Node contains two important aspects:
    prompt generation from templates and state transitions
    within langgraph.

    Every subclass of LLMNode MUST implement the
    `update_state` method to update the state of the graph.
    """

    def __init__(
        self, model, system_template: str, user_template: str, name: str = None
    ):
        """
        Construct a LLM call functor from a LLM model and
        the corresponding templates.
        """
        self.prompt = ChatPromptTemplate.from_messages(
            [("system", system_template), ("user", user_template)]
        )

        self._llm_chain = self.prompt | model
        self.model = model

        self._name = name

    def __call__(self, state):
        return self.update_state(state)

    def invoke_llm(self, input: dict) -> BaseMessage:
        """
        Invokes the LLM within the node over the given input.

        Pre-Condition:
            - `input` is formatted according to the parameters
            passed within the prompt template.

        Returns:
            - response from LLM.
        """
        if DEBUG:
            start_time = time.time()

        res = self._llm_chain.invoke(input)

        if DEBUG:
            if self._name:
                print(f"[{self._name}] Time spent: {time.time() - start_time}")

        return res

    def invoke_on_messages(
        self, input: dict, msgLists: list[list[BaseMessage]]
    ) -> BaseMessage:
        """
        Invokes the LLM with additional messages.
        """
        start_time = time.time()

        hist = ChatMessageHistory()

        # Perform template completion for shorter variables
        # then add it to the chat messages
        prompt_msg = self.prompt.invoke(input).to_messages()

        # if DEBUG:
        #     print("[PROMPT_MSG]", prompt_msg)

        hist.add_messages(prompt_msg)
        hist.add_ai_message(" ")

        for msgList in msgLists:
            hist.add_messages(msgList)
            hist.add_ai_message(" ")

        hist.add_user_message("DONE")

        # if DEBUG:
        #     for msg in hist.messages:
        #         print("[MSGLIST] ", msg)

        res = self.model.invoke(hist.messages)

        if DEBUG:
            if self._name:
                print(f"[{self._name}] Time spent: {time.time() - start_time}")

        return res

    @abstractmethod
    def update_state(self, state) -> dict:
        """
        Calls the LLM model to update the state within the graph.
        Every subclass of LLM model must implement this method.

        Post-Condition:
            - returns a dictionary that represents field updates
                within `state`. Mutates state in the process.
        """
        pass
