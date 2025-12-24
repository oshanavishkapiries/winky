"""
Goal Planner
============
Uses LLM to break down user goals into executable tasks.
Now with AX-Tree role-based element detection.
"""

import json
from typing import List, Dict, Optional
from llm.ollama_client import OllamaClient
from memory.context import ContextManager


SYSTEM_PROMPT = """You are a browser automation task planner. Break down user goals into browser actions.

IMPORTANT RULE: ALWAYS use "inspect" action BEFORE any extract or click action to discover page elements!

AVAILABLE ACTIONS (use ONLY these):
- navigate: Go to URL. Params: {"url": "https://..."}
- wait: Wait. Params: {} for page load, {"duration": 3000} for 3 seconds
- inspect: ALWAYS USE THIS FIRST after navigation! Params: {"find_elements": true, "get_links": true}
- extract: Get data using selectors from inspect. Params: {"selector": "article, .post, h2", "multiple": true}
- click: Click element. Params: {"role": "link", "name": "Next"} or {"selector": "a.next"}
- type_text: Type text. Params: {"role": "textbox", "text": "...", "press_enter": true}
- scroll: Scroll page. Params: {"direction": "down"} or {"to_bottom": true}
- screenshot: Take screenshot. Params: {}
- reload: Refresh page. Params: {}

REQUIRED WORKFLOW:
1. navigate -> wait -> inspect (learn page structure)
2. Then extract/click based on inspect results
3. Use suggested_selectors from inspect for extraction

RESPONSE FORMAT (JSON only):
{
  "tasks": [
    {"action": "navigate", "description": "Go to website", "params": {"url": "https://example.com"}},
    {"action": "wait", "description": "Wait for page", "params": {"duration": 2000}},
    {"action": "inspect", "description": "Analyze page structure", "params": {"find_elements": true}},
    {"action": "extract", "description": "Get articles", "params": {"selector": "article, .post, .card", "multiple": true}}
  ]
}

RULES:
1. ALWAYS inspect after navigate+wait, BEFORE extract/click
2. Use broad selectors: article, .post, .card, h2, a, li
3. JSON only - no explanations
"""


class GoalPlanner:
    """Plans executable tasks from user goals using LLM."""
    
    def __init__(
        self,
        llm_client: Optional[OllamaClient] = None,
        context_manager: Optional[ContextManager] = None
    ):
        """
        Initialize goal planner.
        
        Args:
            llm_client: Ollama client instance
            context_manager: Context manager for memory
        """
        self.llm = llm_client or OllamaClient()
        self.context = context_manager or ContextManager()
    
    async def plan(self, goal: str) -> List[Dict]:
        """
        Create a task plan from a user goal.
        
        Args:
            goal: User's goal in natural language
            
        Returns:
            List of task dictionaries
        """
        print(f"📋 Planning tasks for: {goal}")
        
        # Set goal in context
        self.context.set_goal(goal)
        
        # Build prompt with context
        context_str = self.context.get_context_for_llm()
        
        prompt = f"""User Goal: {goal}

{context_str if context_str else ""}

Break this goal into specific browser automation tasks.
Return a JSON object with a "tasks" array containing the ordered steps.
Each task must have: action, description, params.

IMPORTANT: Use role-based element detection:
- For search boxes: {{"role": "combobox"}} or {{"role": "searchbox"}} or {{"role": "textbox"}}
- For buttons: {{"role": "button", "name": "button text"}}
- For links: {{"role": "link", "name": "link text"}}

JSON Response:"""
        
        try:
            # Get LLM response
            response = await self.llm.generate_json(
                prompt=prompt,
                system=SYSTEM_PROMPT,
                temperature=0.3
            )
            
            tasks = response.get("tasks", [])
            
            # Add tasks to context
            for task in tasks:
                self.context.add_task(task)
            
            # Print planned tasks
            print(f"✅ Planned {len(tasks)} tasks:")
            for i, task in enumerate(tasks):
                print(f"   {i+1}. [{task.get('action')}] {task.get('description')}")
            
            return tasks
            
        except Exception as e:
            print(f"❌ Planning failed: {e}")
            return []
    
    async def refine_task(self, task: Dict, error: str) -> Dict:
        """
        Refine a failed task based on error.
        
        Args:
            task: The failed task
            error: Error message
            
        Returns:
            Refined task dictionary
        """
        prompt = f"""The following browser automation task failed:

Task: {json.dumps(task, indent=2)}
Error: {error}

Please provide a corrected version of this task.
Consider:
- Use role-based selectors: {{"role": "textbox"}} instead of CSS selectors
- Add wait time before action
- Try alternative approaches

Return only the corrected task as JSON:"""
        
        try:
            refined = await self.llm.generate_json(
                prompt=prompt,
                system=SYSTEM_PROMPT,
                temperature=0.3
            )
            
            return refined
            
        except Exception as e:
            print(f"❌ Refinement failed: {e}")
            return task
    
    async def create_loop_pattern(
        self,
        extraction_goal: str,
        page_context: str = ""
    ) -> Dict:
        """
        Create a loop pattern for bulk extraction.
        
        Args:
            extraction_goal: What to extract
            page_context: Current page info/selectors
            
        Returns:
            Loop action configuration
        """
        prompt = f"""Create a loop pattern for bulk data extraction.

Goal: {extraction_goal}
Page Context: {page_context}

Return a loop configuration JSON with:
- pattern: Array of extraction steps
- pagination: How to go to next page
- stop_condition: When to stop

Example format:
{{
  "action": "loop",
  "pattern": [
    {{"action": "extract", "selector": ".item-title", "save_as": "title", "multiple": true}}
  ],
  "pagination": {{
    "type": "click",
    "role": "link",
    "name": "Next",
    "wait_after": 2000
  }},
  "stop_condition": {{
    "type": "no_next_button"
  }}
}}

JSON Response:"""
        
        try:
            return await self.llm.generate_json(
                prompt=prompt,
                system=SYSTEM_PROMPT,
                temperature=0.3
            )
        except Exception as e:
            print(f"❌ Loop pattern creation failed: {e}")
            return {}
