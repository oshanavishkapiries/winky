"""
Browser Tab Action
==================
Manage browser tabs - create, close, switch.
"""

from typing import Optional, List
from playwright.async_api import Page, BrowserContext
from actions.base import BaseAction, ActionResult


class TabAction(BaseAction):
    """Action to manage browser tabs."""
    
    name = "tab"
    description = "Manage browser tabs - create, close, switch"
    
    def __init__(self, page: Page, context: BrowserContext = None):
        """Initialize with page and context."""
        super().__init__(page)
        self.context = context
    
    async def execute(
        self,
        operation: str = None,
        url: Optional[str] = None,
        tab_index: Optional[int] = None,
        **kwargs
    ) -> ActionResult:
        """
        Manage browser tabs.
        
        Args:
            operation: Tab operation - "new", "close", "switch", "list"
            url: URL to open in new tab (for "new" operation)
            tab_index: Tab index to switch to or close (0-based)
            
        Returns:
            ActionResult with success status
        """
        if not operation:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="'operation' parameter required (new, close, switch, list)"
            )
        
        operation = operation.lower()
        
        try:
            if operation == "new":
                return await self._new_tab(url)
            elif operation == "close":
                return await self._close_tab(tab_index)
            elif operation == "switch":
                return await self._switch_tab(tab_index)
            elif operation == "list":
                return await self._list_tabs()
            elif operation == "reload":
                return await self._reload()
            else:
                return ActionResult(
                    success=False,
                    action_name=self.name,
                    error=f"Unknown operation: {operation}"
                )
                
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
    
    async def _new_tab(self, url: Optional[str] = None) -> ActionResult:
        """Create a new tab."""
        if not self.context:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="Browser context not available"
            )
        
        new_page = await self.context.new_page()
        
        if url:
            await new_page.goto(url, wait_until="domcontentloaded")
            self.log(f"Opened new tab: {url}")
        else:
            self.log("Opened new blank tab")
        
        return ActionResult(
            success=True,
            action_name=self.name,
            data={"tab_count": len(self.context.pages)},
            metadata={"operation": "new", "url": url}
        )
    
    async def _close_tab(self, tab_index: Optional[int] = None) -> ActionResult:
        """Close a tab."""
        if not self.context:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="Browser context not available"
            )
        
        pages = self.context.pages
        
        if len(pages) <= 1:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="Cannot close the only tab"
            )
        
        if tab_index is None:
            # Close current tab
            await self.page.close()
            self.log("Closed current tab")
        else:
            if 0 <= tab_index < len(pages):
                await pages[tab_index].close()
                self.log(f"Closed tab {tab_index}")
            else:
                return ActionResult(
                    success=False,
                    action_name=self.name,
                    error=f"Invalid tab index: {tab_index}"
                )
        
        return ActionResult(
            success=True,
            action_name=self.name,
            data={"tab_count": len(self.context.pages)},
            metadata={"operation": "close", "tab_index": tab_index}
        )
    
    async def _switch_tab(self, tab_index: int) -> ActionResult:
        """Switch to a tab."""
        if not self.context:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="Browser context not available"
            )
        
        pages = self.context.pages
        
        if tab_index is None:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="tab_index required for switch operation"
            )
        
        if 0 <= tab_index < len(pages):
            await pages[tab_index].bring_to_front()
            self.log(f"Switched to tab {tab_index}")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data={"current_tab": tab_index, "url": pages[tab_index].url},
                metadata={"operation": "switch", "tab_index": tab_index}
            )
        else:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=f"Invalid tab index: {tab_index}"
            )
    
    async def _list_tabs(self) -> ActionResult:
        """List all open tabs."""
        if not self.context:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="Browser context not available"
            )
        
        tabs = []
        for i, page in enumerate(self.context.pages):
            tabs.append({
                "index": i,
                "url": page.url,
                "title": await page.title()
            })
        
        self.log(f"Found {len(tabs)} tabs")
        
        return ActionResult(
            success=True,
            action_name=self.name,
            data=tabs,
            metadata={"operation": "list", "tab_count": len(tabs)}
        )
    
    async def _reload(self) -> ActionResult:
        """Reload current page."""
        await self.page.reload(wait_until="domcontentloaded")
        self.log("Page reloaded")
        
        return ActionResult(
            success=True,
            action_name=self.name,
            metadata={"operation": "reload", "url": self.page.url}
        )
