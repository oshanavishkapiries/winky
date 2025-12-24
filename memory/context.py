"""
Context Manager
===============
Manages conversation context for LLM interactions.
"""

from typing import List, Dict, Optional
from datetime import datetime
from memory.vector_store import VectorStore


class ContextManager:
    """Manages conversation context and history for LLM."""
    
    def __init__(self, vector_store: Optional[VectorStore] = None):
        """
        Initialize context manager.
        
        Args:
            vector_store: VectorStore instance for persistent memory
        """
        self.vector_store = vector_store or VectorStore()
        self.session_history: List[Dict] = []
        self.current_goal: Optional[str] = None
        self.current_tasks: List[Dict] = []
        self.extracted_data: List[Dict] = []
    
    def set_goal(self, goal: str) -> None:
        """Set the current goal."""
        self.current_goal = goal
        self._add_to_history("goal", goal)
    
    def add_task(self, task: Dict) -> None:
        """Add a task to the current task list."""
        self.current_tasks.append(task)
    
    def complete_task(self, task_index: int, result: Dict) -> None:
        """Mark a task as complete with result."""
        if 0 <= task_index < len(self.current_tasks):
            self.current_tasks[task_index]["completed"] = True
            self.current_tasks[task_index]["result"] = result
    
    def add_extracted_data(self, data: Dict) -> None:
        """Add extracted data to context."""
        self.extracted_data.append({
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
    
    def _add_to_history(self, event_type: str, content: str, metadata: Dict = None) -> None:
        """Add event to session history."""
        event = {
            "type": event_type,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        self.session_history.append(event)
        
        # Also save to vector store for long-term memory
        if self.vector_store:
            self.vector_store.add_memory(
                content=content,
                metadata={"type": event_type, **(metadata or {})}
            )
    
    def get_context_for_llm(self, max_history: int = 10) -> str:
        """
        Build context string for LLM.
        
        Args:
            max_history: Max number of history items to include
            
        Returns:
            Formatted context string
        """
        context_parts = []
        
        # Current goal
        if self.current_goal:
            context_parts.append(f"CURRENT GOAL: {self.current_goal}")
        
        # Task progress
        if self.current_tasks:
            context_parts.append("\nTASKS:")
            for i, task in enumerate(self.current_tasks):
                status = "✅" if task.get("completed") else "⏳"
                context_parts.append(f"  {status} {i+1}. {task.get('description', 'Unknown')}")
        
        # Recent history
        if self.session_history:
            recent = self.session_history[-max_history:]
            context_parts.append("\nRECENT ACTIONS:")
            for event in recent:
                context_parts.append(f"  - [{event['type']}] {event['content'][:100]}")
        
        # Extracted data summary
        if self.extracted_data:
            context_parts.append(f"\nEXTRACTED DATA: {len(self.extracted_data)} items collected")
        
        return "\n".join(context_parts)
    
    def get_relevant_memories(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Get relevant memories for a query.
        
        Args:
            query: Search query
            limit: Max results
            
        Returns:
            List of relevant memories
        """
        if self.vector_store:
            return self.vector_store.search(query, n_results=limit)
        return []
    
    def clear_session(self) -> None:
        """Clear current session data."""
        self.session_history = []
        self.current_goal = None
        self.current_tasks = []
        self.extracted_data = []
    
    def to_dict(self) -> Dict:
        """Export context as dictionary."""
        return {
            "goal": self.current_goal,
            "tasks": self.current_tasks,
            "history": self.session_history,
            "extracted_data": self.extracted_data
        }
