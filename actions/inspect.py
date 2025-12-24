"""
Page Inspect Action
===================
Inspect and analyze page structure using AX-Tree.
"""

from typing import Optional, List, Dict
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class InspectAction(BaseAction):
    """Action to inspect page structure."""
    
    name = "inspect"
    description = "Inspect page structure and find elements"
    
    async def execute(
        self,
        find_elements: bool = True,
        get_links: bool = False,
        get_buttons: bool = False,
        get_inputs: bool = False,
        selector: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """
        Inspect page structure.
        
        Args:
            find_elements: Get all interactive elements via AX-Tree
            get_links: Get all links on page
            get_buttons: Get all buttons on page
            get_inputs: Get all input fields on page
            selector: Test if specific selector exists
            
        Returns:
            ActionResult with page structure info
        """
        try:
            data = {
                "url": self.page.url,
                "title": await self.page.title()
            }
            
            # Test specific selector
            if selector:
                count = await self.page.locator(selector).count()
                data["selector_test"] = {
                    "selector": selector,
                    "found": count > 0,
                    "count": count
                }
                self.log(f"Selector '{selector}': {count} found")
            
            # Get interactive elements via AX-Tree (may not work with persistent context)
            if find_elements:
                try:
                    ax_tree = await self.page.accessibility.snapshot()
                    elements = []
                    if ax_tree:
                        self._extract_elements(ax_tree, elements)
                    data["interactive_elements"] = elements[:50]
                    self.log(f"Found {len(elements)} interactive elements")
                except Exception:
                    # Fallback: get interactive elements via selectors
                    elements = await self._get_interactive_elements_fallback()
                    data["interactive_elements"] = elements[:50]
                    self.log(f"Found {len(elements)} interactive elements (fallback)")
            
            # Get all links
            if get_links:
                links = await self._get_links()
                data["links"] = links[:30]  # Limit
                self.log(f"Found {len(links)} links")
            
            # Get all buttons
            if get_buttons:
                buttons = await self._get_buttons()
                data["buttons"] = buttons[:20]
                self.log(f"Found {len(buttons)} buttons")
            
            # Get all inputs
            if get_inputs:
                inputs = await self._get_inputs()
                data["inputs"] = inputs[:20]
                self.log(f"Found {len(inputs)} inputs")
            
            # Find common selectors that work
            data["suggested_selectors"] = await self._find_working_selectors()
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data=data,
                metadata={"url": self.page.url}
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
    
    def _extract_elements(self, node: Dict, result: List, depth: int = 0) -> None:
        """Extract interactive elements from AX-Tree."""
        if not node or depth > 10:
            return
        
        role = node.get("role", "")
        name = node.get("name", "")
        
        interactive_roles = {
            "button", "link", "textbox", "searchbox", "combobox",
            "checkbox", "radio", "menuitem", "tab", "option"
        }
        
        if role in interactive_roles and name:
            result.append({
                "role": role,
                "name": name[:100],
                "focused": node.get("focused", False)
            })
        
        for child in node.get("children", []):
            self._extract_elements(child, result, depth + 1)
    
    async def _get_links(self) -> List[Dict]:
        """Get all links on page."""
        links = []
        elements = await self.page.query_selector_all("a[href]")
        
        for el in elements[:50]:
            href = await el.get_attribute("href")
            text = await el.text_content()
            if href:
                links.append({
                    "text": (text or "").strip()[:50],
                    "href": href[:200]
                })
        
        return links
    
    async def _get_buttons(self) -> List[Dict]:
        """Get all buttons on page."""
        buttons = []
        elements = await self.page.query_selector_all("button, input[type='submit'], [role='button']")
        
        for el in elements[:30]:
            text = await el.text_content() or await el.get_attribute("value") or ""
            buttons.append({
                "text": text.strip()[:50]
            })
        
        return buttons
    
    async def _get_inputs(self) -> List[Dict]:
        """Get all input fields on page."""
        inputs = []
        elements = await self.page.query_selector_all("input, textarea, select")
        
        for el in elements[:30]:
            name = await el.get_attribute("name") or ""
            type_ = await el.get_attribute("type") or "text"
            placeholder = await el.get_attribute("placeholder") or ""
            inputs.append({
                "name": name,
                "type": type_,
                "placeholder": placeholder[:50]
            })
        
        return inputs
    
    async def _find_working_selectors(self) -> List[str]:
        """Find commonly used selectors that work on this page."""
        common_selectors = [
            "article", ".post", ".card", ".item",
            "table", "tr", "ul li", "ol li",
            "h1", "h2", "h3", "p",
            ".content", ".main", "#content"
        ]
        
        working = []
        for selector in common_selectors:
            try:
                count = await self.page.locator(selector).count()
                if count > 0:
                    working.append(f"{selector} ({count})")
            except:
                pass
        
        return working
    
    async def _get_interactive_elements_fallback(self) -> List[Dict]:
        """Fallback method when accessibility API unavailable."""
        elements = []
        
        # Get links
        links = await self.page.query_selector_all("a[href]")
        for el in links[:20]:
            text = await el.text_content()
            if text and text.strip():
                elements.append({
                    "role": "link",
                    "name": text.strip()[:50]
                })
        
        # Get buttons
        buttons = await self.page.query_selector_all("button, [role='button']")
        for el in buttons[:10]:
            text = await el.text_content()
            if text and text.strip():
                elements.append({
                    "role": "button",
                    "name": text.strip()[:50]
                })
        
        # Get inputs
        inputs = await self.page.query_selector_all("input, textarea")
        for el in inputs[:10]:
            placeholder = await el.get_attribute("placeholder") or ""
            name = await el.get_attribute("name") or ""
            elements.append({
                "role": "textbox",
                "name": placeholder or name or "input"
            })
        
        return elements
