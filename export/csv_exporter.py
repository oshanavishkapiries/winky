"""
CSV Exporter
============
Export extracted data to CSV files.
"""

import csv
import os
from typing import List, Dict, Any, Optional
from datetime import datetime


class CSVExporter:
    """Export data to CSV files."""
    
    def __init__(self, output_dir: str = "./output"):
        """
        Initialize CSV exporter.
        
        Args:
            output_dir: Directory to save CSV files
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def export(
        self,
        data: List[Dict],
        filename: str,
        append: bool = False,
        timestamp: bool = True,
        headers: Optional[List[str]] = None
    ) -> str:
        """
        Export data to CSV file.
        
        Args:
            data: List of dictionaries to export
            filename: Base filename (without extension)
            append: Append to existing file if True
            timestamp: Add timestamp to filename
            headers: Custom headers (auto-detected if None)
            
        Returns:
            Path to saved CSV file
        """
        if not data:
            print("⚠️ No data to export")
            return ""
        
        # Build filename
        if timestamp and not append:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{filename}_{ts}"
        
        filepath = os.path.join(self.output_dir, f"{filename}.csv")
        
        # Determine headers
        if headers is None:
            # Get all unique keys from data
            all_keys = set()
            for item in data:
                if isinstance(item, dict):
                    all_keys.update(item.keys())
            headers = sorted(list(all_keys))
        
        # Check if file exists for append mode
        file_exists = os.path.exists(filepath)
        mode = "a" if append and file_exists else "w"
        
        # Write CSV
        with open(filepath, mode, newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
            
            # Write header only if new file or not appending
            if mode == "w":
                writer.writeheader()
            
            for item in data:
                if isinstance(item, dict):
                    writer.writerow(item)
                else:
                    # Handle non-dict items (e.g., strings)
                    writer.writerow({headers[0]: item} if headers else {"value": item})
        
        print(f"📊 Exported {len(data)} rows to: {filepath}")
        return filepath
    
    def export_flat(
        self,
        data: List[Any],
        filename: str,
        column_name: str = "value",
        timestamp: bool = True
    ) -> str:
        """
        Export flat list of values to CSV.
        
        Args:
            data: List of values
            filename: Base filename
            column_name: Name for the value column
            timestamp: Add timestamp to filename
            
        Returns:
            Path to saved CSV file
        """
        # Convert to list of dicts
        dict_data = [{column_name: item} for item in data]
        return self.export(dict_data, filename, timestamp=timestamp)
    
    def read(self, filepath: str) -> List[Dict]:
        """
        Read CSV file back to list of dicts.
        
        Args:
            filepath: Path to CSV file
            
        Returns:
            List of dictionaries
        """
        data = []
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append(dict(row))
        return data
