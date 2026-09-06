from typing import Any, Optional

from google.adk.agents import LlmAgent

from backend.agent.tools import build_tools


def build_chronicle_agent(
    model: str,
    instruction: str,
    memories: list[Any],
    graph_context: Optional[list[Any]] = None,
) -> LlmAgent:
    return LlmAgent(
        name="chronicle_companion",
        model=model,
        instruction=instruction,
        tools=build_tools(memories, graph_context),
    )
