"""
Extract Action
==============
Extract data from page elements.
"""

from typing import List, Optional, Dict, Any
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class ExtractAction(BaseAction):
    """Action to extract data from page elements."""
    
    name = "extract"
    description = "Extract data from page elements"
    
    async def execute(
        self,
        selector: str = None,
        attribute: Optional[str] = None,
        multiple: bool = False,
        save_as: Optional[str] = None,
        timeout: int = 5000,
        extract_fields: Optional[Dict] = None,
        **kwargs
    ) -> ActionResult:
        """
        Extract data from page elements.
        
        Args:
            selector: CSS selector of element(s) to extract from
            attribute: Attribute to extract (href, src, etc). 
                      If None, extracts text content
            multiple: Extract from all matching elements
            save_as: Key name to save extracted data
            timeout: Max wait time in milliseconds
            extract_fields: Dict of {field_name: {selector, attribute}} for complex extractions
            
        Returns:
            ActionResult with extracted data
        """
        # Validate selector
        if not selector:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="'selector' parameter is required"
            )
        
        # Validate attribute is a string if provided
        if attribute and not isinstance(attribute, str):
            attribute = None  # Fallback to text content
        
        try:
            # Wait for element
            await self.page.wait_for_selector(selector, timeout=timeout)
            
            # Complex extraction with multiple fields
            if extract_fields and isinstance(extract_fields, dict):
                return await self._extract_complex(selector, extract_fields, multiple, save_as, timeout)
            
            if multiple:
                # Extract from all matching elements
                elements = await self.page.query_selector_all(selector)
                data = []
                
                for element in elements:
                    item_data = {}
                    
                    # Get text content
                    text = await element.text_content()
                    if text:
                        item_data["text"] = text.strip()
                    
                    # Get href if it's a link or has link inside
                    link = await element.query_selector("a")
                    if link:
                        href = await link.get_attribute("href")
                        if href:
                            item_data["link"] = href
                    elif attribute == "href":
                        href = await element.get_attribute("href")
                        if href:
                            item_data["link"] = href
                    
                    # Get specific attribute if provided
                    if attribute and isinstance(attribute, str):
                        attr_value = await element.get_attribute(attribute)
                        if attr_value:
                            item_data[attribute] = attr_value
                    
                    if item_data:
                        data.append(item_data)
                
                self.log(f"Extracted {len(data)} items from: {selector}")
                
            else:
                # Extract from first matching element
                element = await self.page.query_selector(selector)
                
                if attribute and isinstance(attribute, str):
                    data = await element.get_attribute(attribute)
                else:
                    data = await element.text_content()
                
                if data:
                    data = data.strip()
                
                self.log(f"Extracted data from: {selector}")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data=data,
                metadata={
                    "selector": selector,
                    "attribute": attribute,
                    "multiple": multiple,
                    "save_as": save_as,
                    "count": len(data) if isinstance(data, list) else 1
                }
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e),
                metadata={"selector": selector}
            )
    
    async def _extract_complex(
        self,
        container_selector: str,
        fields: Dict,
        multiple: bool,
        save_as: Optional[str],
        timeout: int
    ) -> ActionResult:
        """Extract multiple fields from container elements."""
        try:
            elements = await self.page.query_selector_all(container_selector)
            data = []
            
            for element in elements:
                item = {}
                for field_name, field_config in fields.items():
                    if isinstance(field_config, dict):
                        sub_selector = field_config.get("selector", "")
                        attr = field_config.get("attribute")
                        
                        sub_element = await element.query_selector(sub_selector)
                        if sub_element:
                            if attr:
                                value = await sub_element.get_attribute(attr)
                            else:
                                value = await sub_element.text_content()
                            if value:
                                item[field_name] = value.strip()
                
                if item:
                    data.append(item)
            
            self.log(f"Extracted {len(data)} complex items")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data=data,
                metadata={"save_as": save_as, "count": len(data)}
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
    
    async def extract_table(
        self,
        table_selector: str,
        row_selector: str = "tr",
        cell_selector: str = "td",
        headers: Optional[List[str]] = None,
        skip_header_row: bool = True,
        timeout: int = 5000
    ) -> ActionResult:
        """
        Extract data from an HTML table.
        
        Args:
            table_selector: CSS selector for the table
            row_selector: Selector for table rows
            cell_selector: Selector for table cells
            headers: Column headers (if None, uses first row)
            skip_header_row: Skip first row if using it as headers
            timeout: Max wait time
            
        Returns:
            ActionResult with table data as list of dicts
        """
        try:
            await self.page.wait_for_selector(table_selector, timeout=timeout)
            
            rows = await self.page.query_selector_all(f"{table_selector} {row_selector}")
            
            if not rows:
                return ActionResult(
                    success=False,
                    action_name=self.name,
                    error="No rows found in table"
                )
            
            # Get headers from first row if not provided
            if headers is None and rows:
                header_cells = await rows[0].query_selector_all("th, td")
                headers = []
                for cell in header_cells:
                    text = await cell.text_content()
                    headers.append(text.strip() if text else "")
            
            # Extract data rows
            data = []
            start_idx = 1 if skip_header_row else 0
            
            for row in rows[start_idx:]:
                cells = await row.query_selector_all(cell_selector)
                row_data = {}
                
                for idx, cell in enumerate(cells):
                    text = await cell.text_content()
                    key = headers[idx] if idx < len(headers) else f"column_{idx}"
                    row_data[key] = text.strip() if text else ""
                
                data.append(row_data)
            
            self.log(f"Extracted {len(data)} rows from table")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data=data,
                metadata={
                    "table_selector": table_selector,
                    "row_count": len(data),
                    "headers": headers
                }
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e)
            )
