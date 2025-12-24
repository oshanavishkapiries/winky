"""
Loop Action
===========
Pattern-based repetition without LLM calls.
Handles pagination and bulk data extraction.
"""

import asyncio
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from actions.base import BaseAction, ActionResult


class LoopAction(BaseAction):
    """
    Action for pattern-based repetition.
    
    LLM defines pattern once, this action repeats it
    without additional LLM calls - saves tokens!
    """
    
    name = "loop"
    description = "Execute a pattern repeatedly with pagination support"
    
    def __init__(self, page: Page, action_registry: Dict = None):
        """
        Initialize loop action.
        
        Args:
            page: Playwright page instance
            action_registry: Dict mapping action names to action classes
        """
        super().__init__(page)
        self.action_registry = action_registry or {}
        self.collected_data: List[Any] = []
    
    async def execute(
        self,
        pattern: List[Dict] = None,
        pagination: Optional[Dict] = None,
        stop_condition: Optional[Dict] = None,
        on_empty: str = "stop",
        max_iterations: int = 100,
        delay_between: int = 1000,
        **kwargs
    ) -> ActionResult:
        """
        Execute a pattern repeatedly.
        
        Args:
            pattern: List of action definitions to repeat
                    [{"action": "extract", "selector": ".item", "save_as": "items"}]
            pagination: Pagination config
                       {"type": "click", "selector": "button.next", "wait_after": 2000}
            stop_condition: When to stop
                           {"type": "max_iterations", "value": 50}
                           {"type": "no_next_button"}
                           {"type": "empty_results"}
            on_empty: What to do when no results ("stop" or "continue")
            max_iterations: Safety limit for iterations
            delay_between: Delay between iterations in ms
            
        Returns:
            ActionResult with all collected data
        """
        # Validate parameters
        if not pattern:
            return ActionResult(
                success=False,
                action_name=self.name,
                error="Pattern is required"
            )
        
        self.collected_data = []
        iteration = 0
        
        # Parse stop condition
        stop_type = "max_iterations"
        stop_value = max_iterations
        
        if stop_condition:
            stop_type = stop_condition.get("type", "max_iterations")
            stop_value = stop_condition.get("value", max_iterations)
        
        self.log(f"Starting loop with stop condition: {stop_type}")
        
        try:
            while iteration < max_iterations:
                iteration += 1
                self.log(f"Iteration {iteration}")
                
                # Execute pattern
                iteration_data = []
                pattern_success = True
                
                for step in pattern:
                    result = await self._execute_step(step)
                    
                    if not result.success:
                        pattern_success = False
                        self.log(f"Step failed: {result.error}")
                        break
                    
                    if result.data:
                        iteration_data.append(result.data)
                
                # Handle empty results
                if not iteration_data:
                    if on_empty == "stop":
                        self.log("No data found, stopping")
                        break
                
                # Add collected data
                self.collected_data.extend(iteration_data)
                
                # Check stop conditions
                if stop_type == "max_iterations" and iteration >= stop_value:
                    self.log(f"Reached max iterations: {stop_value}")
                    break
                
                if stop_type == "empty_results" and not iteration_data:
                    self.log("Empty results, stopping")
                    break
                
                # Handle pagination
                if pagination:
                    has_next = await self._paginate(pagination)
                    
                    if not has_next:
                        if stop_type == "no_next_button":
                            self.log("No next button found, stopping")
                        break
                else:
                    # No pagination, single iteration
                    break
                
                # Delay between iterations
                if delay_between > 0:
                    await asyncio.sleep(delay_between / 1000)
            
            self.log(f"Loop completed: {iteration} iterations, {len(self.collected_data)} items")
            
            return ActionResult(
                success=True,
                action_name=self.name,
                data=self.collected_data,
                metadata={
                    "iterations": iteration,
                    "items_collected": len(self.collected_data),
                    "stop_reason": stop_type
                }
            )
            
        except Exception as e:
            return ActionResult(
                success=False,
                action_name=self.name,
                error=str(e),
                data=self.collected_data,  # Return partial data
                metadata={"iterations": iteration}
            )
    
    async def _execute_step(self, step: Dict) -> ActionResult:
        """Execute a single step in the pattern."""
        action_name = step.get("action")
        
        if not action_name:
            return ActionResult(
                success=False,
                action_name="unknown",
                error="Action name not specified in step"
            )
        
        # Get action class from registry
        action_class = self.action_registry.get(action_name)
        
        if not action_class:
            # Handle basic actions inline
            if action_name == "extract":
                return await self._extract_inline(step)
            elif action_name == "click":
                return await self._click_inline(step)
            elif action_name == "wait":
                return await self._wait_inline(step)
            else:
                return ActionResult(
                    success=False,
                    action_name=action_name,
                    error=f"Unknown action: {action_name}"
                )
        
        # Execute action from registry
        action = action_class(self.page)
        step_params = {k: v for k, v in step.items() if k != "action"}
        return await action.execute(**step_params)
    
    async def _extract_inline(self, step: Dict) -> ActionResult:
        """Inline extraction for loop steps."""
        selector = step.get("selector")
        attribute = step.get("attribute")
        multiple = step.get("multiple", True)
        
        try:
            if multiple:
                elements = await self.page.query_selector_all(selector)
                data = []
                for el in elements:
                    if attribute:
                        value = await el.get_attribute(attribute)
                    else:
                        value = await el.text_content()
                    if value:
                        data.append(value.strip())
            else:
                element = await self.page.query_selector(selector)
                if element:
                    if attribute:
                        data = await element.get_attribute(attribute)
                    else:
                        data = await element.text_content()
                    data = data.strip() if data else None
                else:
                    data = None
            
            return ActionResult(
                success=True,
                action_name="extract",
                data=data
            )
        except Exception as e:
            return ActionResult(
                success=False,
                action_name="extract",
                error=str(e)
            )
    
    async def _click_inline(self, step: Dict) -> ActionResult:
        """Inline click for loop steps."""
        selector = step.get("selector")
        try:
            await self.page.click(selector, timeout=5000)
            return ActionResult(success=True, action_name="click")
        except Exception as e:
            return ActionResult(success=False, action_name="click", error=str(e))
    
    async def _wait_inline(self, step: Dict) -> ActionResult:
        """Inline wait for loop steps."""
        duration = step.get("duration", 1000)
        await asyncio.sleep(duration / 1000)
        return ActionResult(success=True, action_name="wait")
    
    async def _paginate(self, pagination: Dict) -> bool:
        """
        Handle pagination.
        
        Returns:
            True if pagination successful, False if no next page
        """
        pagination_type = pagination.get("type", "click")
        selector = pagination.get("selector")
        wait_after = pagination.get("wait_after", 2000)
        
        if pagination_type == "click":
            try:
                # Check if next button exists
                next_button = await self.page.query_selector(selector)
                
                if not next_button:
                    return False
                
                # Check if button is disabled
                is_disabled = await next_button.get_attribute("disabled")
                if is_disabled:
                    return False
                
                # Click next button
                await next_button.click()
                
                # Wait for new content
                await asyncio.sleep(wait_after / 1000)
                
                return True
                
            except Exception as e:
                self.log(f"Pagination failed: {e}")
                return False
        
        elif pagination_type == "scroll":
            # Scroll to load more content
            try:
                await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(wait_after / 1000)
                return True
            except Exception:
                return False
        
        return False
