"""
Base Action Class
=================
Abstract base class for all browser actions.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from playwright.async_api import Page


class ActionResult:
    """Result of an action execution."""
    
    def __init__(
        self,
        success: bool,
        action_name: str,
        data: Optional[Any] = None,
        error: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        self.success = success
        self.action_name = action_name
        self.data = data
        self.error = error
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict:
        """Convert result to dictionary for logging."""
        return {
            "action": self.action_name,
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "metadata": self.metadata
        }


class BaseAction(ABC):
    """Abstract base class for browser actions."""
    
    name: str = "base"
    description: str = "Base action class"
    
    def __init__(self, page: Page):
        """Initialize action with browser page."""
        self.page = page
    
    @abstractmethod
    async def execute(self, **kwargs) -> ActionResult:
        """
        Execute the action.
        
        Args:
            **kwargs: Action-specific parameters
            
        Returns:
            ActionResult with success status and data
        """
        pass
    
    def validate_params(self, required: list, provided: dict) -> Optional[str]:
        """
        Validate required parameters are provided.
        
        Args:
            required: List of required parameter names
            provided: Dict of provided parameters
            
        Returns:
            Error message if validation fails, None otherwise
        """
        missing = [p for p in required if p not in provided or provided[p] is None]
        if missing:
            return f"Missing required parameters: {', '.join(missing)}"
        return None
    
    async def wait_for_element(
        self,
        selector: str,
        timeout: int = 5000,
        state: str = "visible"
    ) -> bool:
        """
        Wait for an element to be in a specific state.
        
        Args:
            selector: CSS selector or text
            timeout: Max wait time in milliseconds
            state: Element state (visible, hidden, attached, detached)
            
        Returns:
            True if element found, False otherwise
        """
        try:
            await self.page.wait_for_selector(selector, timeout=timeout, state=state)
            return True
        except Exception:
            return False
    
    def log(self, message: str) -> None:
        """Log action message."""
        print(f"  [{self.name}] {message}")
