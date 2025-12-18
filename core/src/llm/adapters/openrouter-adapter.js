/**
 * OpenRouter LLM Adapter
 * Implementation of BaseLLMAdapter for OpenRouter API
 * OpenRouter provides access to multiple LLM providers through a unified API
 */
const { BaseLLMAdapter } = require('./base-adapter');

class OpenRouterAdapter extends BaseLLMAdapter {
    constructor(config) {
        super(config);
        this.name = 'openrouter';
        this.apiKey = config.apiKey;
        this.model = config.model || 'openai/gpt-4o-mini';
        this.baseUrl = 'https://openrouter.ai/api/v1';
        this.siteUrl = config.siteUrl || 'http://localhost:3000';
        this.siteName = config.siteName || 'Browser Agent';
    }

    /**
     * Generate next action using OpenRouter
     * @param {Object} context - Current context
     * @returns {Promise<Object>} - Action object with llmData (prompt, response)
     */
    async generateAction(context) {
        const prompt = this.buildPrompt(context);
        let rawResponse = '';

        const apiCall = async () => {
            const requestBody = {
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a browser automation agent. Always respond with valid JSON only.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: this.config.maxTokens || 4096,
                temperature: this.config.temperature || 0.2,
                top_p: this.config.topP || 0.9
            };

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': this.siteUrl,
                    'X-Title': this.siteName
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`OpenRouter API error: ${response.status} - ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            rawResponse = data.choices?.[0]?.message?.content || '';

            if (this.config.verbose) {
                console.log('\n OpenRouter Response:', rawResponse.substring(0, 500) + '...');
            }

            const parsedAction = this.parseResponse(rawResponse);

            // Attach LLM data to action for logging
            parsedAction._llmData = {
                model: this.model,
                prompt: prompt,
                response: rawResponse,
                usage: data.usage || null
            };

            return parsedAction;
        };

        try {
            // Use rate limiter if available
            if (this.rateLimiter) {
                return await this.rateLimiter.execute(apiCall, 'OpenRouter API');
            } else {
                return await apiCall();
            }
        } catch (error) {
            console.error('❌ OpenRouter API error:', error.message);

            // Return a safe fallback action
            return {
                action_type: 'terminate',
                reasoning: `LLM API error: ${error.message}`,
                errors: [error.message],
                _llmData: {
                    model: this.model,
                    prompt: prompt,
                    response: null,
                    error: error.message
                }
            };
        }
    }

    /**
     * Get model info for logging
     */
    getModelInfo() {
        return {
            provider: 'OpenRouter',
            model: this.model,
            adapter: this.name
        };
    }
}

module.exports = { OpenRouterAdapter };
