/**
 * Ollama Local LLM Adapter
 * For running local models via Ollama API
 * No npm package needed - uses fetch
 */
const { BaseLLMAdapter } = require('./base-adapter');

class OllamaAdapter extends BaseLLMAdapter {
    constructor(config) {
        super(config);
        this.name = 'ollama';
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model || 'llama3.2';
    }

    async generateAction(context) {
        const prompt = this.buildPrompt(context);

        const apiCall = async () => {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: `You are a browser automation agent. Always respond with valid JSON only.\n\n${prompt}`,
                    stream: false,
                    options: {
                        temperature: this.config.temperature || 0.2,
                        num_predict: this.config.maxTokens || 4096
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            const responseText = data.response || '';

            if (this.config.verbose) {
                console.log(`  [ollama] ${responseText.substring(0, 100)}...`);
            }

            return this.parseResponse(responseText);
        };

        try {
            // Use rate limiter if available
            if (this.rateLimiter) {
                return await this.rateLimiter.execute(apiCall, 'Ollama API');
            } else {
                return await apiCall();
            }
        } catch (error) {
            console.error(`  [error] Ollama: ${error.message}`);

            return {
                action_type: 'terminate',
                reasoning: `LLM API error: ${error.message}`,
                errors: [error.message]
            };
        }
    }

    getModelInfo() {
        return {
            provider: 'Ollama (Local)',
            model: this.model,
            baseUrl: this.baseUrl,
            adapter: this.name
        };
    }
}

module.exports = { OllamaAdapter };
