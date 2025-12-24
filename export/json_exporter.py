"""
JSON Exporter
=============
Export extracted data to JSON files.
"""

import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime


class JSONExporter:
    """Export data to JSON files."""
    
    def __init__(self, output_dir: str = "./output"):
        """
        Initialize JSON exporter.
        
        Args:
            output_dir: Directory to save JSON files
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def export(
        self,
        data: Any,
        filename: str,
        timestamp: bool = True,
        indent: int = 2,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Export data to JSON file.
        
        Args:
            data: Data to export (any JSON-serializable type)
            filename: Base filename (without extension)
            timestamp: Add timestamp to filename
            indent: JSON indentation
            metadata: Additional metadata to include
            
        Returns:
            Path to saved JSON file
        """
        # Build filename
        if timestamp:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{filename}_{ts}"
        
        filepath = os.path.join(self.output_dir, f"{filename}.json")
        
        # Build output structure
        output = {
            "exported_at": datetime.now().isoformat(),
            "count": len(data) if isinstance(data, (list, dict)) else 1,
            "data": data
        }
        
        if metadata:
            output["metadata"] = metadata
        
        # Write JSON
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=indent, ensure_ascii=False, default=str)
        
        print(f"📋 Exported to: {filepath}")
        return filepath
    
    def append(
        self,
        data: Any,
        filename: str
    ) -> str:
        """
        Append data to existing JSON file.
        
        Args:
            data: Data to append
            filename: Filename (without extension)
            
        Returns:
            Path to JSON file
        """
        filepath = os.path.join(self.output_dir, f"{filename}.json")
        
        existing_data = []
        
        # Read existing data if file exists
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                content = json.load(f)
                existing_data = content.get("data", [])
                if not isinstance(existing_data, list):
                    existing_data = [existing_data]
        
        # Append new data
        if isinstance(data, list):
            existing_data.extend(data)
        else:
            existing_data.append(data)
        
        # Write back
        return self.export(existing_data, filename.split("_")[0], timestamp=False)
    
    def read(self, filepath: str) -> Any:
        """
        Read JSON file.
        
        Args:
            filepath: Path to JSON file
            
        Returns:
            Parsed JSON data
        """
        with open(filepath, "r", encoding="utf-8") as f:
            content = json.load(f)
        return content.get("data", content)
