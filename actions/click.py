"""
Click Action
============
Click on elements by selector, text, or role.
"""

from typing import Optional
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class ClickAction(BaseAction):
    """Action to click on page elements."""
    
    name = "click"
    description = "Click on an element by selector, text, or role"
    
    async def execute(
        self,
        selector: Optional[str] = None,
        text: Optional[str] = None,
        role: Optional[str] = None,
        role_name: Optional[str] = None,
        timeout: int = 10000,
        **kwargs
    ) -> ActionResult:
        """
        Click on an element.
        
        Args:
            selector: CSS selector of element to click
            text: Text content of element to click
            role: AX-Tree role (button, link, textbox, etc.)
            role_name: Name of element (for role-based selection)
            timeout: Max wait time in milliseconds
            
        Returns:
            ActionResult with success status
        """
        # Also check for 'name' parameter as alias for role_name
        if role_name is None:
            role_name = kwargs.get("name")
        
        try:
            # Priority: role > selector > text
            if role:
                if role_name:
                    locator = f'role={role}[name*="{role_name}" i]'
                else:
                    locator = f'role={role}'
                self.log(f"Clicking role: {role}" + (f" [{role_name}]" if role_name else ""))
                await self.page.click(locator, timeout=timeout)
                
            elif selector:
                self.log(f"Clicking selector: {selector}")
                await self.page.click(selector, timeout=timeout)
                
            elif text:
                self.log(f"Clicking text: {text}")
                await self.page.click(f"text={text}", timeout=timeout)
                
            else:
                return ActionResult(
                    success=False,
                    action_name=self.name,
                    error="Either 'role', 'selector', or 'text' must be provided"
                )
            
            return ActionResult(
                success=True,
                action_name=self.name,
                metadata={"role": role, "selector": selector, "text": text}
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e),
                metadata={"role": role, "selector": selector, "text": text}
            )
