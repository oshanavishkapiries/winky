"""
Orchestrator
============
Main coordinator for the browser automation agent.
"""

import asyncio
from typing import Optional, Dict, List
from browser.manager import BrowserManager
from llm.ollama_client import OllamaClient
from memory.context import ContextManager
from memory.vector_store import VectorStore
from core.goal_planner import GoalPlanner
from core.executor import Executor
from export.csv_exporter import CSVExporter
from export.json_exporter import JSONExporter
from session_logging.replayer import Replayer


class Orchestrator:
    """Main orchestrator for browser automation agent."""
    
    def __init__(self):
        """Initialize orchestrator."""
        self.browser_manager: Optional[BrowserManager] = None
        self.llm: Optional[OllamaClient] = None
        self.vector_store: Optional[VectorStore] = None
        self.context: Optional[ContextManager] = None
        self.planner: Optional[GoalPlanner] = None
        self.executor: Optional[Executor] = None
        self.csv_exporter = CSVExporter()
        self.json_exporter = JSONExporter()
        
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize all components."""
        print("🚀 Initializing Browser Automation Agent...")
        print("=" * 50)
        
        # Initialize LLM
        print("\n[1/4] Connecting to Ollama...")
        self.llm = OllamaClient()
        
        if await self.llm.check_connection():
            print("✅ Ollama connected")
            models = await self.llm.list_models()
            print(f"   Available models: {', '.join(models[:5])}")
        else:
            print("⚠️ Ollama not available - planning features disabled")
        
        # Initialize memory
        print("\n[2/4] Setting up memory...")
        self.vector_store = VectorStore()
        self.context = ContextManager(self.vector_store)
        print(f"✅ Memory initialized ({self.vector_store.count()} memories)")
        
        # Initialize browser
        print("\n[3/4] Launching browser...")
        self.browser_manager = BrowserManager()
        page = await self.browser_manager.initialize()
        
        # Initialize planner and executor
        print("\n[4/4] Setting up planner and executor...")
        self.planner = GoalPlanner(self.llm, self.context)
        self.executor = Executor(page, context=self.browser_manager.context)
        print("✅ Ready!")
        
        print("=" * 50)
        self._initialized = True
    
    async def run(self, goal: str) -> Dict:
        """
        Run the agent with a goal.
        
        Args:
            goal: User's goal in natural language
            
        Returns:
            Execution result
        """
        if not self._initialized:
            await self.initialize()
        
        print(f"\n🎯 Goal: {goal}")
        print("=" * 50)
        
        # Plan tasks
        tasks = await self.planner.plan(goal)
        
        if not tasks:
            return {
                "success": False,
                "error": "Failed to plan tasks"
            }
        
        # Execute tasks
        result = await self.executor.execute_plan(tasks, goal)
        
        # Export collected data
        if result.get("collected_data"):
            await self._export_data(result["collected_data"], goal)
        
        # Summary
        print("\n" + "=" * 50)
        if result["success"]:
            print("🎉 Goal completed successfully!")
        else:
            print(f"❌ Goal failed: {result.get('failed_task', {}).get('error')}")
        
        print(f"📊 Tasks: {result['completed_tasks']}/{result['total_tasks']} completed")
        print(f"📝 Log: {result.get('log_path')}")
        
        return result
    
    async def _export_data(self, collected_data: List[Dict], goal: str) -> None:
        """Export collected data to files."""
        all_data = []
        
        for item in collected_data:
            data = item.get("data")
            if isinstance(data, list):
                all_data.extend(data)
            elif data:
                all_data.append(data)
        
        if all_data:
            # Create filename from goal
            filename = goal[:30].replace(" ", "_").lower()
            filename = "".join(c for c in filename if c.isalnum() or c == "_")
            
            # Export CSV
            self.csv_exporter.export(all_data, filename)
            
            # Export JSON
            self.json_exporter.export(all_data, filename)
    
    async def replay(self, session_id: str, speed: float = 1.0) -> Dict:
        """
        Replay a logged session.
        
        Args:
            session_id: Session ID to replay
            speed: Replay speed (1.0 = normal)
            
        Returns:
            Replay result
        """
        if not self._initialized:
            await self.initialize()
        
        page = await self.browser_manager.get_page()
        replayer = Replayer(page)
        
        return await replayer.replay(session_id, speed)
    
    async def list_sessions(self) -> List[Dict]:
        """List all logged sessions."""
        from session_logging.action_logger import ActionLogger
        logger = ActionLogger()
        return logger.list_sessions()
    
    async def close(self) -> None:
        """Cleanup and close all resources."""
        if self.browser_manager:
            await self.browser_manager.close()
        
        if self.llm:
            await self.llm.close()
        
        self._initialized = False
        print("👋 Agent closed")
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
