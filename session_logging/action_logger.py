"""
Action Logger
=============
Logs all executed actions to JSON for replay.
"""

import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid


class ActionLogger:
    """Logs browser actions to JSON files for replay."""
    
    def __init__(self, logs_dir: str = "./logs"):
        """
        Initialize action logger.
        
        Args:
            logs_dir: Directory to save log files
        """
        self.logs_dir = logs_dir
        os.makedirs(logs_dir, exist_ok=True)
        
        self.session_id: Optional[str] = None
        self.goal: Optional[str] = None
        self.actions: List[Dict] = []
        self.start_time: Optional[datetime] = None
    
    def start_session(self, goal: str) -> str:
        """
        Start a new logging session.
        
        Args:
            goal: The user's goal for this session
            
        Returns:
            Session ID
        """
        self.session_id = f"session_{uuid.uuid4().hex[:8]}"
        self.goal = goal
        self.actions = []
        self.start_time = datetime.now()
        
        print(f"📝 Logging session started: {self.session_id}")
        return self.session_id
    
    def log_action(
        self,
        action: str,
        params: Dict,
        result: Dict,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """
        Log an executed action.
        
        Args:
            action: Action name (click, navigate, etc.)
            params: Action parameters
            result: Action result/data
            success: Whether action succeeded
            error: Error message if failed
        """
        log_entry = {
            "action": action,
            "params": params,
            "result": result,
            "success": success,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        
        self.actions.append(log_entry)
    
    def end_session(
        self,
        success: bool = True,
        error: Optional[str] = None
    ) -> str:
        """
        End the logging session and save to file.
        
        Args:
            success: Whether overall session succeeded
            error: Error message if session failed
            
        Returns:
            Path to saved log file
        """
        if not self.session_id:
            return ""
        
        end_time = datetime.now()
        
        log_data = {
            "session_id": self.session_id,
            "goal": self.goal,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": end_time.isoformat(),
            "duration_seconds": (end_time - self.start_time).total_seconds() if self.start_time else 0,
            "success": success,
            "error": error,
            "action_count": len(self.actions),
            "actions": self.actions
        }
        
        # Save to file
        filepath = os.path.join(self.logs_dir, f"{self.session_id}.json")
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(log_data, f, indent=2, ensure_ascii=False)
        
        print(f"📝 Log saved: {filepath}")
        
        # Reset session
        session_id = self.session_id
        self.session_id = None
        self.goal = None
        self.actions = []
        self.start_time = None
        
        return filepath
    
    def get_log(self, session_id: str) -> Optional[Dict]:
        """
        Read a log file by session ID.
        
        Args:
            session_id: Session ID to load
            
        Returns:
            Log data dictionary or None if not found
        """
        filepath = os.path.join(self.logs_dir, f"{session_id}.json")
        
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def list_sessions(self) -> List[Dict]:
        """
        List all logged sessions.
        
        Returns:
            List of session summaries
        """
        sessions = []
        
        for filename in os.listdir(self.logs_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.logs_dir, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    sessions.append({
                        "session_id": data.get("session_id"),
                        "goal": data.get("goal"),
                        "start_time": data.get("start_time"),
                        "success": data.get("success"),
                        "action_count": data.get("action_count")
                    })
        
        # Sort by start time (newest first)
        sessions.sort(key=lambda x: x.get("start_time", ""), reverse=True)
        
        return sessions
