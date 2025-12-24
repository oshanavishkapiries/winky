"""
Wait Action
===========
Wait for elements, time, or conditions.
"""

import asyncio
from typing import Optional
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class WaitAction(BaseAction):
    """Action to wait for various conditions."""
    
    name = "wait"
    description = "Wait for element, time, or page state"
    
    async def execute(
        self,
        selector: Optional[str] = None,
        timeout: int = 5000,
        state: str = "visible",
        duration: Optional[int] = None,
        wait_for: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """
        Wait for a condition.
        
        Args:
            selector: CSS selector to wait for (if waiting for element)
            timeout: Max wait time in milliseconds
            state: Element state (visible, hidden, attached, detached)
            duration: Fixed time to wait in milliseconds (if waiting for time)
            wait_for: Page state to wait for (load, domcontentloaded, networkidle)
            
        Returns:
            ActionResult with success status
        """
        try:
            # Default: wait for page load if no specific condition
            if not duration and not wait_for and not selector:
                self.log("Waiting for page to load")
                await self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
                await asyncio.sleep(1)  # Extra buffer
                return ActionResult(
                    success=True,
                    action_name=self.name,
                    metadata={"default_wait": True}
                )
            
            # Wait for fixed duration
            if duration:
                self.log(f"Waiting for {duration}ms")
                await asyncio.sleep(duration / 1000)
                return ActionResult(
                    success=True,
                    action_name=self.name,
                    metadata={"duration": duration}
                )
            
            # Wait for page state
            if wait_for:
                self.log(f"Waiting for page state: {wait_for}")
                await self.page.wait_for_load_state(wait_for, timeout=timeout)
                return ActionResult(
                    success=True,
                    action_name=self.name,
                    metadata={"wait_for": wait_for}
                )
            
            # Wait for element
            if selector:
                self.log(f"Waiting for element: {selector} ({state})")
                await self.page.wait_for_selector(
                    selector,
                    timeout=timeout,
                    state=state
                )
                return ActionResult(
                    success=True,
                    action_name=self.name,
                    metadata={"selector": selector, "state": state}
                )
            
            return ActionResult(
                success=False,
                action_name=self.name,
                error="No wait condition specified"
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e),
                metadata={"selector": selector, "duration": duration}
            )
