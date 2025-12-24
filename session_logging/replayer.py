"""
Replayer
========
Replay actions from a logged session.
"""

import asyncio
import json
from typing import Dict, List, Optional
from playwright.async_api import Page

from session_logging.action_logger import ActionLogger


class Replayer:
    """Replay browser actions from a log file."""
    
    def __init__(self, page: Page, action_registry: Dict = None):
        """
        Initialize replayer.
        
        Args:
            page: Playwright page instance
            action_registry: Dict mapping action names to action classes
        """
        self.page = page
        self.action_registry = action_registry or {}
        self.logger = ActionLogger()
    
    async def replay(
        self,
        session_id: str,
        speed: float = 1.0,
        stop_on_error: bool = True
    ) -> Dict:
        """
        Replay a logged session.
        
        Args:
            session_id: Session ID to replay
            speed: Replay speed multiplier (1.0 = normal, 2.0 = 2x faster)
            stop_on_error: Stop replay if an action fails
            
        Returns:
            Replay result with success status
        """
        # Load log file
        log_data = self.logger.get_log(session_id)
        
        if not log_data:
            return {
                "success": False,
                "error": f"Session not found: {session_id}"
            }
        
        actions = log_data.get("actions", [])
        
        if not actions:
            return {
                "success": False,
                "error": "No actions to replay"
            }
        
        print(f"🔄 Replaying session: {session_id}")
        print(f"   Goal: {log_data.get('goal')}")
        print(f"   Actions: {len(actions)}")
        print("-" * 40)
        
        results = []
        success_count = 0
        
        for i, action_log in enumerate(actions):
            action_name = action_log.get("action")
            params = action_log.get("params", {})
            
            print(f"  [{i+1}/{len(actions)}] {action_name}")
            
            try:
                result = await self._execute_action(action_name, params)
                results.append(result)
                
                if result.get("success"):
                    success_count += 1
                    print(f"      ✅ Success")
                else:
                    print(f"      ❌ Failed: {result.get('error')}")
                    if stop_on_error:
                        break
                
            except Exception as e:
                print(f"      ❌ Error: {e}")
                results.append({"success": False, "error": str(e)})
                if stop_on_error:
                    break
            
            # Apply speed factor (wait less if faster)
            if speed > 0 and i < len(actions) - 1:
                await asyncio.sleep(0.5 / speed)
        
        print("-" * 40)
        print(f"🔄 Replay complete: {success_count}/{len(actions)} actions succeeded")
        
        return {
            "success": success_count == len(actions),
            "session_id": session_id,
            "total_actions": len(actions),
            "successful_actions": success_count,
            "results": results
        }
    
    async def _execute_action(self, action_name: str, params: Dict) -> Dict:
        """Execute a single action during replay."""
        
        # Handle basic actions inline
        if action_name == "navigate":
            try:
                url = params.get("url")
                await self.page.goto(url, wait_until="domcontentloaded")
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        elif action_name == "click":
            try:
                selector = params.get("selector")
                text = params.get("text")
                if selector:
                    await self.page.click(selector)
                elif text:
                    await self.page.click(f"text={text}")
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        elif action_name == "type_text":
            try:
                selector = params.get("selector")
                text = params.get("text")
                await self.page.fill(selector, "")
                await self.page.type(selector, text)
                if params.get("press_enter"):
                    await self.page.press(selector, "Enter")
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        elif action_name == "wait":
            try:
                duration = params.get("duration", 1000)
                await asyncio.sleep(duration / 1000)
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        elif action_name == "extract":
            # Skip extraction during replay (data collection not needed)
            return {"success": True, "skipped": True}
        
        # Try action registry
        action_class = self.action_registry.get(action_name)
        if action_class:
            action = action_class(self.page)
            result = await action.execute(**params)
            return result.to_dict()
        
        return {"success": False, "error": f"Unknown action: {action_name}"}
    
    def list_available_sessions(self) -> List[Dict]:
        """List all available sessions for replay."""
        return self.logger.list_sessions()
