"""
Accessibility Tree Analyzer
===========================
Uses AX-Tree for reliable element detection and interaction.
"""

from typing import Dict, List, Optional, Any
from playwright.async_api import Page


class AXTreeAnalyzer:
    """Analyzes page using Accessibility Tree for better element detection."""
    
    def __init__(self, page: Page):
        """Initialize with Playwright page."""
        self.page = page
        self._cached_tree = None
    
    async def get_tree(self, refresh: bool = False) -> Dict:
        """
        Get the accessibility tree snapshot.
        
        Args:
            refresh: Force refresh of cached tree
            
        Returns:
            AX-Tree as dict
        """
        if self._cached_tree is None or refresh:
            self._cached_tree = await self.page.accessibility.snapshot()
        return self._cached_tree
    
    async def get_interactive_elements(self) -> List[Dict]:
        """
        Get all interactive elements from the page.
        
        Returns:
            List of interactive elements with their properties
        """
        tree = await self.get_tree(refresh=True)
        
        if not tree:
            return []
        
        interactive = []
        self._extract_interactive(tree, interactive)
        return interactive
    
    def _extract_interactive(self, node: Dict, result: List, depth: int = 0) -> None:
        """Recursively extract interactive elements from AX-Tree."""
        if not node:
            return
        
        role = node.get("role", "")
        name = node.get("name", "")
        
        # Interactive roles
        interactive_roles = {
            "button", "link", "textbox", "searchbox", "combobox",
            "checkbox", "radio", "menuitem", "tab", "option",
            "spinbutton", "slider", "switch"
        }
        
        if role in interactive_roles:
            result.append({
                "role": role,
                "name": name,
                "description": node.get("description", ""),
                "value": node.get("value", ""),
                "focused": node.get("focused", False),
                "depth": depth
            })
        
        # Recurse into children
        for child in node.get("children", []):
            self._extract_interactive(child, result, depth + 1)
    
    async def find_element_by_role(
        self,
        role: str,
        name: Optional[str] = None,
        exact: bool = False
    ) -> Optional[str]:
        """
        Find element locator by role and optional name.
        
        Args:
            role: Element role (button, textbox, link, etc.)
            name: Optional element name/label
            exact: Require exact name match
            
        Returns:
            Playwright locator string
        """
        if name:
            if exact:
                return f"role={role}[name=\"{name}\"]"
            else:
                return f"role={role}[name*=\"{name}\" i]"
        return f"role={role}"
    
    async def find_search_box(self) -> Optional[str]:
        """Find search box on the page."""
        elements = await self.get_interactive_elements()
        
        # Look for searchbox or textbox roles
        for el in elements:
            role = el.get("role", "")
            name = el.get("name", "").lower()
            
            if role in ["searchbox", "textbox"]:
                # Prioritize search-related names
                if any(kw in name for kw in ["search", "query", "find"]):
                    return f"role={role}[name=\"{el['name']}\"]"
        
        # Fallback to any searchbox or first textbox
        for el in elements:
            if el.get("role") == "searchbox":
                return f"role=searchbox"
        for el in elements:
            if el.get("role") == "textbox":
                return f"role=textbox >> nth=0"
        
        return None
    
    async def find_button(self, text: str) -> Optional[str]:
        """Find button by text."""
        return f"role=button[name*=\"{text}\" i]"
    
    async def find_link(self, text: str) -> Optional[str]:
        """Find link by text."""
        return f"role=link[name*=\"{text}\" i]"
    
    async def get_page_summary(self) -> str:
        """
        Get a summary of the page for LLM context.
        
        Returns:
            Human-readable page summary
        """
        elements = await self.get_interactive_elements()
        
        summary_parts = [f"Page has {len(elements)} interactive elements:"]
        
        # Group by role
        role_counts = {}
        for el in elements:
            role = el.get("role", "unknown")
            role_counts[role] = role_counts.get(role, 0) + 1
        
        for role, count in sorted(role_counts.items()):
            summary_parts.append(f"  - {count} {role}(s)")
        
        # List key elements
        summary_parts.append("\nKey elements:")
        for el in elements[:15]:  # First 15
            name = el.get("name", "")[:50]
            if name:
                summary_parts.append(f"  - [{el['role']}] {name}")
        
        return "\n".join(summary_parts)
    
    async def click_by_role(self, role: str, name: str = None) -> bool:
        """
        Click element by role.
        
        Args:
            role: Element role
            name: Element name (optional)
            
        Returns:
            True if clicked successfully
        """
        try:
            locator = await self.find_element_by_role(role, name)
            await self.page.click(locator, timeout=10000)
            return True
        except Exception as e:
            print(f"     AX-Tree click failed: {e}")
            return False
    
    async def type_in_role(
        self,
        role: str,
        text: str,
        name: str = None,
        press_enter: bool = False
    ) -> bool:
        """
        Type text into element by role.
        
        Args:
            role: Element role (textbox, searchbox)
            text: Text to type
            name: Element name (optional)
            press_enter: Press Enter after typing
            
        Returns:
            True if successful
        """
        try:
            locator = await self.find_element_by_role(role, name)
            element = self.page.locator(locator)
            
            await element.fill("")
            await element.type(text, delay=50)
            
            if press_enter:
                await element.press("Enter")
            
            return True
        except Exception as e:
            print(f"     AX-Tree type failed: {e}")
            return False
