"""
Scroll Action
=============
Scroll the page in various directions or to elements.
"""

from typing import Optional
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class ScrollAction(BaseAction):
    """Action to scroll the page."""
    
    name = "scroll"
    description = "Scroll the page up, down, or to an element"
    
    async def execute(
        self,
        direction: Optional[str] = None,
        pixels: int = 500,
        selector: Optional[str] = None,
        role: Optional[str] = None,
        role_name: Optional[str] = None,
        to_bottom: bool = False,
        to_top: bool = False,
        smooth: bool = True,
        **kwargs
    ) -> ActionResult:
        """
        Scroll the page.
        
        Args:
            direction: Scroll direction - "up", "down", "left", "right"
            pixels: Number of pixels to scroll
            selector: CSS selector to scroll into view
            role: Role of element to scroll into view
            role_name: Name of element (for role-based selection)
            to_bottom: Scroll to page bottom
            to_top: Scroll to page top
            smooth: Use smooth scrolling
            
        Returns:
            ActionResult with success status
        """
        try:
            # Scroll to element by selector or role
            if selector or role:
                return await self._scroll_to_element(
                    selector=selector,
                    role=role,
                    role_name=role_name or kwargs.get("name")
                )
            
            # Scroll to top
            if to_top:
                self.log("Scrolling to top")
                await self.page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
                return ActionResult(
                    success=True,
                    action_name=self.name,
                    metadata={"to_top": True}
                )
            
            # Scroll to bottom
            if to_bottom:
                self.log("Scrolling to bottom")
                await self.page.evaluate(
                    "window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})"
                )
                return ActionResult(
                    success=True,
                    action_name=self.name,
                    metadata={"to_bottom": True}
                )
            
            # Scroll by direction
            if direction:
                return await self._scroll_direction(direction, pixels, smooth)
            
            # Default: scroll down
            return await self._scroll_direction("down", pixels, smooth)
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
    
    async def _scroll_direction(
        self,
        direction: str,
        pixels: int,
        smooth: bool
    ) -> ActionResult:
        """Scroll in a direction."""
        direction = direction.lower()
        behavior = "'smooth'" if smooth else "'auto'"
        
        scroll_map = {
            "down": f"window.scrollBy({{top: {pixels}, behavior: {behavior}}})",
            "up": f"window.scrollBy({{top: -{pixels}, behavior: {behavior}}})",
            "right": f"window.scrollBy({{left: {pixels}, behavior: {behavior}}})",
            "left": f"window.scrollBy({{left: -{pixels}, behavior: {behavior}}})",
        }
        
        if direction not in scroll_map:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=f"Invalid direction: {direction}. Use up, down, left, right"
            )
        
        self.log(f"Scrolling {direction} {pixels}px")
        await self.page.evaluate(scroll_map[direction])
        
        return ActionResult(
            success=True,
            action_name=self.name,
            metadata={"direction": direction, "pixels": pixels}
        )
    
    async def _scroll_to_element(
        self,
        selector: Optional[str] = None,
        role: Optional[str] = None,
        role_name: Optional[str] = None
    ) -> ActionResult:
        """Scroll element into view."""
        try:
            if role:
                if role_name:
                    locator = f'role={role}[name*="{role_name}" i]'
                else:
                    locator = f'role={role}'
                self.log(f"Scrolling to role: {role}")
            else:
                locator = selector
                self.log(f"Scrolling to: {selector}")
            
            element = self.page.locator(locator).first
            await element.scroll_into_view_if_needed()
            
            return ActionResult(
                success=True,
                action_name=self.name,
                metadata={"selector": selector, "role": role}
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
