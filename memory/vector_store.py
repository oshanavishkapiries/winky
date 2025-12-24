"""
Vector Store
============
ChromaDB integration for conversation memory.
"""

import os
from typing import List, Dict, Optional, Any
from datetime import datetime

try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("⚠️ ChromaDB not installed. Memory features disabled.")


class VectorStore:
    """Vector database for storing conversation history and context."""
    
    def __init__(
        self,
        collection_name: str = "browser_agent_memory",
        persist_directory: str = "./data/chromadb"
    ):
        """
        Initialize vector store.
        
        Args:
            collection_name: Name of the ChromaDB collection
            persist_directory: Directory to persist database
        """
        self.collection_name = collection_name
        self.persist_directory = persist_directory
        self.client = None
        self.collection = None
        
        if CHROMADB_AVAILABLE:
            self._initialize()
    
    def _initialize(self):
        """Initialize ChromaDB client and collection."""
        os.makedirs(self.persist_directory, exist_ok=True)
        
        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )
        
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "Browser automation agent memory"}
        )
        
        print(f"📚 Vector store initialized: {self.collection_name}")
    
    def add_memory(
        self,
        content: str,
        metadata: Optional[Dict] = None,
        memory_id: Optional[str] = None
    ) -> str:
        """
        Add a memory to the store.
        
        Args:
            content: Text content to store
            metadata: Additional metadata
            memory_id: Custom ID (auto-generated if not provided)
            
        Returns:
            Memory ID
        """
        if not CHROMADB_AVAILABLE or not self.collection:
            return ""
        
        if memory_id is None:
            memory_id = f"mem_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        meta = metadata or {}
        meta["timestamp"] = datetime.now().isoformat()
        
        self.collection.add(
            documents=[content],
            metadatas=[meta],
            ids=[memory_id]
        )
        
        return memory_id
    
    def search(
        self,
        query: str,
        n_results: int = 5,
        where: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Search for relevant memories.
        
        Args:
            query: Search query
            n_results: Number of results to return
            where: Filter conditions
            
        Returns:
            List of matching memories with metadata
        """
        if not CHROMADB_AVAILABLE or not self.collection:
            return []
        
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where
        )
        
        memories = []
        for i in range(len(results["ids"][0])):
            memories.append({
                "id": results["ids"][0][i],
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else None
            })
        
        return memories
    
    def get_recent(self, limit: int = 10) -> List[Dict]:
        """
        Get most recent memories.
        
        Args:
            limit: Number of memories to return
            
        Returns:
            List of recent memories
        """
        if not CHROMADB_AVAILABLE or not self.collection:
            return []
        
        # Get all memories and sort by timestamp
        results = self.collection.get(
            include=["documents", "metadatas"]
        )
        
        memories = []
        for i in range(len(results["ids"])):
            memories.append({
                "id": results["ids"][i],
                "content": results["documents"][i],
                "metadata": results["metadatas"][i] if results["metadatas"] else {}
            })
        
        # Sort by timestamp (newest first)
        memories.sort(
            key=lambda x: x.get("metadata", {}).get("timestamp", ""),
            reverse=True
        )
        
        return memories[:limit]
    
    def clear(self) -> None:
        """Clear all memories from the collection."""
        if not CHROMADB_AVAILABLE or not self.client:
            return
        
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.create_collection(
            name=self.collection_name,
            metadata={"description": "Browser automation agent memory"}
        )
        print("🗑️ Memory cleared")
    
    def count(self) -> int:
        """Get number of memories in store."""
        if not CHROMADB_AVAILABLE or not self.collection:
            return 0
        return self.collection.count()
