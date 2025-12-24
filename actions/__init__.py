"""
Actions module for browser automation agent.
Contains action plugins for browser interactions.
"""

from actions.base import BaseAction
from actions.click import ClickAction
from actions.navigate import NavigateAction
from actions.extract import ExtractAction
from actions.type_text import TypeTextAction
from actions.wait import WaitAction
from actions.loop import LoopAction
from actions.reload import ReloadAction
from actions.tab import TabAction
from actions.scroll import ScrollAction
from actions.screenshot import ScreenshotAction
from actions.inspect import InspectAction

__all__ = [
    "BaseAction",
    "ClickAction",
    "NavigateAction",
    "ExtractAction",
    "TypeTextAction",
    "WaitAction",
    "LoopAction",
    "ReloadAction",
    "TabAction",
    "ScrollAction",
    "ScreenshotAction",
    "InspectAction",
]
