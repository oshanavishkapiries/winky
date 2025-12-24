"""
Executor
========
Executes planned tasks using action plugins.
Includes retry logic for failed tasks.
"""

import asyncio
from typing import Dict, List, Optional, Type
from playwright.async_api import Page, BrowserContext

from actions.base import BaseAction, ActionResult
from actions.click import ClickAction
from actions.navigate import NavigateAction
from actions.extract import ExtractAction
from actions.type_text import TypeTextAction
from actions.wait import WaitAction
from actions.loop import LoopAction
from actions.reload import ReloadAction
from actions.tab import TabAction
from actions.scroll import ScrollAction
from actions.screenshot import ScreenshotAction
from actions.inspect import InspectAction
from session_logging.action_logger import ActionLogger


class Executor:
    """Executes browser automation tasks with retry support."""
    
    def __init__(
        self,
        page: Page,
        context: BrowserContext = None,
        logger: Optional[ActionLogger] = None,
        max_retries: int = 3
    ):
        """
        Initialize executor.
        
        Args:
            page: Playwright page instance
            context: Browser context for tab management
            logger: Action logger for recording actions
            max_retries: Number of retries for failed tasks
        """
        self.page = page
        self.context = context
        self.logger = logger or ActionLogger()
        self.max_retries = max_retries
        
        # Register action handlers
        self.action_registry: Dict[str, Type[BaseAction]] = {
            "click": ClickAction,
            "navigate": NavigateAction,
            "extract": ExtractAction,
            "type_text": TypeTextAction,
            "wait": WaitAction,
            "loop": LoopAction,
            "reload": ReloadAction,
            "tab": TabAction,
            "scroll": ScrollAction,
            "screenshot": ScreenshotAction,
            "inspect": InspectAction,
        }
        
        self.collected_data: List[Dict] = []
        self.last_inspect_result: Optional[Dict] = None  # Store inspect results
    
    async def execute_task(
        self,
        task: Dict,
        retry_count: int = 0
    ) -> ActionResult:
        """
        Execute a single task with retry logic.
        
        Args:
            task: Task dictionary with action, description, params
            retry_count: Current retry attempt
            
        Returns:
            ActionResult with execution status
        """
        action_name = task.get("action")
        description = task.get("description", "")
        params = task.get("params", {})
        
        print(f"  ⚡ {description}")
        
        # Get action class
        action_class = self.action_registry.get(action_name)
        
        if not action_class:
            result = ActionResult(
                success=False,
                action_name=action_name,
                error=f"Unknown action: {action_name}"
            )
        else:
            # Create action instance
            if action_name == "loop":
                action = action_class(self.page, self.action_registry)
            elif action_name == "tab":
                action = action_class(self.page, self.context)
            else:
                action = action_class(self.page)
            
            # Execute action
            result = await action.execute(**params)
        
        # Store inspect results for later use
        if result.success and action_name == "inspect" and result.data:
            self.last_inspect_result = result.data
            # Print suggested selectors
            if "suggested_selectors" in result.data:
                print(f"     📋 Suggested selectors: {', '.join(result.data['suggested_selectors'][:5])}")
        
        # Auto-enhance extract with suggested selectors if selector fails
        if not result.success and action_name == "extract" and self.last_inspect_result:
            suggested = self.last_inspect_result.get("suggested_selectors", [])
            if suggested and retry_count < self.max_retries:
                # Try first suggested selector
                selector = suggested[0].split(" (")[0]  # Remove count like "article (5)"
                print(f"     🔄 Trying suggested selector: {selector}")
                params["selector"] = selector
                action = action_class(self.page)
                result = await action.execute(**params)
        
        # Handle failure with retry
        if not result.success and retry_count < self.max_retries:
            print(f"     ⚠️ Failed, retrying... ({retry_count + 1}/{self.max_retries})")
            
            # Wait before retry
            await asyncio.sleep(1)
            
            # Try page reload on certain errors
            if "timeout" in str(result.error).lower():
                print(f"     🔄 Reloading page...")
                await self.page.reload(wait_until="domcontentloaded")
                await asyncio.sleep(1)
            
            # Retry
            return await self.execute_task(task, retry_count + 1)
        
        # Log action
        self.logger.log_action(
            action=action_name,
            params=params,
            result=result.data if result.data else {},
            success=result.success,
            error=result.error
        )
        
        # Collect extracted data
        if result.success and result.data and action_name in ["extract", "loop"]:
            self.collected_data.append({
                "action": action_name,
                "data": result.data,
                "save_as": params.get("save_as")
            })
        
        # Print result
        if result.success:
            print(f"     ✅ Success")
        else:
            print(f"     ❌ Failed: {result.error}")
        
        return result
    
    async def execute_plan(
        self,
        tasks: List[Dict],
        goal: str,
        stop_on_error: bool = True,
        retry_full_plan: bool = True
    ) -> Dict:
        """
        Execute a full task plan with retry support.
        
        Args:
            tasks: List of task dictionaries
            goal: User's goal
            stop_on_error: Stop if a task fails
            retry_full_plan: Retry entire plan if it fails
            
        Returns:
            Execution summary
        """
        if not tasks:
            return {
                "success": False,
                "error": "No tasks to execute"
            }
        
        # Start logging session
        self.logger.start_session(goal)
        self.collected_data = []
        
        plan_attempts = 0
        max_plan_attempts = self.max_retries
        
        while plan_attempts < max_plan_attempts:
            plan_attempts += 1
            
            if plan_attempts > 1:
                print(f"\n🔄 Retrying entire plan (attempt {plan_attempts}/{max_plan_attempts})...")
                await asyncio.sleep(2)
            
            print(f"\n⚡ Executing {len(tasks)} tasks...")
            print("-" * 40)
            
            success_count = 0
            failed_task = None
            
            for i, task in enumerate(tasks):
                print(f"\n[{i+1}/{len(tasks)}]", end="")
                
                result = await self.execute_task(task)
                
                if result.success:
                    success_count += 1
                else:
                    failed_task = {
                        "task": task,
                        "error": result.error,
                        "index": i
                    }
                    if stop_on_error:
                        break
            
            print("-" * 40)
            
            # Check if plan succeeded
            if success_count == len(tasks):
                # Success!
                log_path = self.logger.end_session(success=True)
                
                return {
                    "success": True,
                    "total_tasks": len(tasks),
                    "completed_tasks": success_count,
                    "attempts": plan_attempts,
                    "collected_data": self.collected_data,
                    "log_path": log_path
                }
            
            # Plan failed
            if not retry_full_plan:
                break
            
            # Don't retry on last attempt
            if plan_attempts >= max_plan_attempts:
                break
            
            print(f"\n⚠️ Plan failed at task {failed_task['index'] + 1}")
        
        # All retries exhausted
        log_path = self.logger.end_session(
            success=False,
            error=failed_task.get("error") if failed_task else "Unknown error"
        )
        
        return {
            "success": False,
            "total_tasks": len(tasks),
            "completed_tasks": success_count,
            "attempts": plan_attempts,
            "failed_task": failed_task,
            "collected_data": self.collected_data,
            "log_path": log_path
        }
    
    def get_collected_data(self) -> List[Dict]:
        """Get all data collected during execution."""
        return self.collected_data
    
    def register_action(self, name: str, action_class: Type[BaseAction]) -> None:
        """
        Register a custom action.
        
        Args:
            name: Action name
            action_class: Action class
        """
        self.action_registry[name] = action_class
