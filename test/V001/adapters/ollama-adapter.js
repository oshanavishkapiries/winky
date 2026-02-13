// adapters/ollama-adapter.js
const axios = require('axios');
const { saveChatLog } = require('../utils/debug-utils');

class OllamaAdapter {
  constructor(model = 'llama3.1:8b', baseUrl = 'https://e4fc-34-16-225-207.ngrok-free.app') {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async chat(messages, toolDefinitions) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages: messages,
        tools: toolDefinitions, // Crucial for Llama 3.1 tool calling
        stream: false,
        options: {
          temperature: 0.3 // Keep it 0 for consistent automation
        },
        format: "json"
      });
      
      const responseMessage = response.data.message;

      // Save messages for debugging
      saveChatLog(messages, responseMessage);

      // Ollama returns the message which might contain tool_calls
      return responseMessage;
    } catch (error) {
      console.error("Ollama API Error:", error.message);
      throw error;
    }
  }
}

module.exports = OllamaAdapter;