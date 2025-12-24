"""
Screenshot Action
=================
Take screenshots of the page or elements.
"""

import os
from typing import Optional
from datetime import datetime
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class ScreenshotAction(BaseAction):
    """Action to take screenshots."""
    
    name = "screenshot"
    description = "Take a screenshot of the page or element"
    
    def __init__(self, page: Page, output_dir: str = "./screenshots"):
        """Initialize with output directory."""
        super().__init__(page)
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    async def execute(
        self,
        filename: Optional[str] = None,
        selector: Optional[str] = None,
        full_page: bool = False,
        **kwargs
    ) -> ActionResult:
        """
        Take a screenshot.
        
        Args:
            filename: Output filename (auto-generated if None)
            selector: CSS selector for element screenshot
            full_page: Capture full scrollable page
            
        Returns:
            ActionResult with screenshot path
        """
        try:
            # Generate filename if not provided
            if not filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"screenshot_{timestamp}.png"
            
            # Ensure .png extension
            if not filename.endswith(".png"):
                filename += ".png"
            
            filepath = os.path.join(self.output_dir, filename)
            
            if selector:
                # Element screenshot
                self.log(f"Taking element screenshot: {selector}")
                element = await self.page.query_selector(selector)
                if element:
                    await element.screenshot(path=filepath)
                else:
                    return ActionResult(
                        success=False,
                        action_name=self.name,
                        error=f"Element not found: {selector}"
                    )
            else:
                # Page screenshot
                self.log(f"Taking {'full page' if full_page else 'viewport'} screenshot")
                await self.page.screenshot(path=filepath, full_page=full_page)
            
            self.log(f"Saved: {filepath}")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data={"path": filepath},
                metadata={
                    "filename": filename,
                    "full_page": full_page,
                    "selector": selector
                }
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
