"""
Type Text Action
================
Type text into input fields by selector or role.
"""

from typing import Optional
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class TypeTextAction(BaseAction):
    """Action to type text into input fields."""
    
    name = "type_text"
    description = "Type text into an input field"
    
    async def execute(
        self,
        text: str = None,
        selector: Optional[str] = None,
        role: Optional[str] = None,
        role_name: Optional[str] = None,
        clear_first: bool = True,
        delay: int = 30,
        press_enter: bool = False,
        timeout: int = 10000,
        **kwargs
    ) -> ActionResult:
        """
        Type text into an input field.
        
        Args:
            text: Text to type
            selector: CSS selector of input field
            role: AX-Tree role (textbox, searchbox, combobox)
            role_name: Name of element (for role-based selection)
            clear_first: Clear existing text before typing
            delay: Delay between keystrokes in milliseconds
            press_enter: Press Enter after typing
            timeout: Max wait time in milliseconds
            
        Returns:
            ActionResult with success status
        """
        # Also check for 'name' parameter as alias for role_name
        if role_name is None:
            role_name = kwargs.get("name")
        
        # Validate text
        if not text:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="'text' parameter is required"
            )
        
        try:
            # Build locator: role takes priority
            if role:
                if role_name:
                    locator = f'role={role}[name*="{role_name}" i]'
                else:
                    locator = f'role={role}'
                self.log(f"Typing into role: {role}" + (f" [{role_name}]" if role_name else ""))
            elif selector:
                locator = selector
                self.log(f"Typing into selector: {selector}")
            else:
                # Default: try common search patterns
                # Try each in order until one works
                for fallback_locator in [
                    'role=combobox',
                    'role=searchbox', 
                    'role=textbox',
                    'textarea[name="q"]',
                    'input[name="q"]',
                    'input[type="text"]'
                ]:
                    try:
                        element = self.page.locator(fallback_locator).first
                        if await element.is_visible(timeout=2000):
                            locator = fallback_locator
                            self.log(f"Found input via fallback: {locator}")
                            break
                    except:
                        continue
                else:
                    return ActionResult(
                        success=False,
                        action_name=self.name,
                        error="Could not find input element"
                    )
            
            # Get element
            element = self.page.locator(locator).first
            
            # Wait for element
            await element.wait_for(state="visible", timeout=timeout)
            
            # Focus and clear if needed
            await element.click()
            
            if clear_first:
                await element.fill("")
            
            # Type text with delay
            await element.type(text, delay=delay)
            self.log(f"Typed: '{text[:30]}{'...' if len(text) > 30 else ''}'")
            
            # Press Enter if requested
            if press_enter:
                await element.press("Enter")
                self.log("Pressed Enter")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                metadata={
                    "role": role,
                    "selector": selector,
                    "text_length": len(text),
                    "press_enter": press_enter
                }
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e),
                metadata={"role": role, "selector": selector}
            )
