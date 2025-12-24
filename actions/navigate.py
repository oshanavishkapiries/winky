"""
Navigate Action
===============
Navigate to URLs.
"""

from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class NavigateAction(BaseAction):
    """Action to navigate to URLs."""
    
    name = "navigate"
    description = "Navigate to a URL"
    
    async def execute(
        self,
        url: str = None,
        wait_until: str = "domcontentloaded",
        timeout: int = 30000,
        **kwargs
    ) -> ActionResult:
        """
        Navigate to a URL.
        
        Args:
            url: URL to navigate to
            wait_until: When to consider navigation complete
                       (load, domcontentloaded, networkidle)
            timeout: Max wait time in milliseconds
            
        Returns:
            ActionResult with success status
        """
        # Validate parameters
        error = self.validate_params(["url"], {"url": url})
        if error:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=error
            )
        
        try:
            self.log(f"Navigating to: {url}")
            response = await self.page.goto(
                url,
                wait_until=wait_until,
                timeout=timeout
            )
            
            status = response.status if response else None
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data={"status_code": status},
                metadata={"url": url, "wait_until": wait_until}
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e),
                metadata={"url": url}
            )
