"""
Reload Action
=============
Reload the current page.
"""

from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class ReloadAction(BaseAction):
    """Action to reload the current page."""
    
    name = "reload"
    description = "Reload the current page"
    
    async def execute(
        self,
        wait_until: str = "domcontentloaded",
        timeout: int = 30000,
        **kwargs
    ) -> ActionResult:
        """
        Reload the current page.
        
        Args:
            wait_until: When to consider reload complete
                       (load, domcontentloaded, networkidle)
            timeout: Max wait time in milliseconds
            
        Returns:
            ActionResult with success status
        """
        try:
            self.log(f"Reloading page: {self.page.url}")
            
            await self.page.reload(
                wait_until=wait_until,
                timeout=timeout
            )
            
            self.log("Page reloaded successfully")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data={"url": self.page.url},
                metadata={"wait_until": wait_until}
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
