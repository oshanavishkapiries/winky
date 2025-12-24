import json
import os
from typing import Dict, List, Optional, Any
import httpx
from dotenv import load_dotenv

load_dotenv()


class OllamaClient:
    """Client for Ollama local LLM."""
    
    def __init__(
        self,
        base_url: str = None,
        model: str = None,
        timeout: int = 120
    ):
        """
        Initialize Ollama client.
        
        Args:
            base_url: Ollama API base URL (from .env if not provided)
            model: Model to use (from .env if not provided)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "codellama:7b")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        format: Optional[str] = None
    ) -> str:
        """
        Generate text from prompt.
        
        Args:
            prompt: User prompt
            system: System prompt
            temperature: Creativity (0-1)
            max_tokens: Max response tokens
            format: Response format ("json" for JSON mode)
            
        Returns:
            Generated text response
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        }
        
        if system:
            payload["system"] = system
        
        if format == "json":
            payload["format"] = "json"
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json=payload
            )
            response.raise_for_status()
            
            result = response.json()
            return result.get("response", "")
            
        except httpx.HTTPError as e:
            print(f"❌ Ollama API error: {e}")
            raise
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        format: Optional[str] = None
    ) -> str:
        """
        Chat completion with message history.
        
        Args:
            messages: List of messages [{"role": "user/assistant/system", "content": "..."}]
            temperature: Creativity (0-1)
            max_tokens: Max response tokens
            format: Response format ("json" for JSON mode)
            
        Returns:
            Assistant response
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        }
        
        if format == "json":
            payload["format"] = "json"
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/chat",
                json=payload
            )
            response.raise_for_status()
            
            result = response.json()
            return result.get("message", {}).get("content", "")
            
        except httpx.HTTPError as e:
            print(f"❌ Ollama API error: {e}")
            raise
    
    async def generate_json(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.3
    ) -> Dict:
        """
        Generate JSON response.
        
        Args:
            prompt: Prompt expecting JSON response
            system: System prompt
            temperature: Lower is more deterministic
            
        Returns:
            Parsed JSON dict
        """
        response = await self.generate(
            prompt=prompt,
            system=system,
            temperature=temperature,
            format="json"
        )
        
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end > start:
                return json.loads(response[start:end])
            raise
    
    async def check_connection(self) -> bool:
        """
        Check if Ollama is running and accessible.
        
        Returns:
            True if connected, False otherwise
        """
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            return response.status_code == 200
        except Exception:
            return False
    
    async def list_models(self) -> List[str]:
        """
        List available models.
        
        Returns:
            List of model names
        """
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            
            data = response.json()
            return [m["name"] for m in data.get("models", [])]
            
        except Exception:
            return []
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
