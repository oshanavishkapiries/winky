/**
 * Cerebras LLM Adapter
 * Implementation of BaseLLMAdapter for Cerebras AI
 */
const Cerebras = require('@cerebras/cerebras_cloud_sdk').default;
const { BaseLLMAdapter } = require('./base-adapter');

class CerebrasAdapter extends BaseLLMAdapter {
    constructor(config) {
        super(config);
        this.name = 'cerebras';

        // Initialize Cerebras client
        this.client = new Cerebras({
            apiKey: config.apiKey
        });

        this.model = config.model || 'llama-4-scout-17b-16e-instruct';
    }

    /**
     * Generate next action using Cerebras
     * @param {Object} context - Current context
     * @returns {Promise<Object>} - Action object
     */
    async generateAction(context) {
        const prompt = this.buildPrompt(context);

        const apiCall = async () => {
            // Use streaming for potentially long responses
            const stream = await this.client.chat.completions.create({
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
                model: this.model,
                stream: true,
                max_completion_tokens: this.config.maxTokens || 4096,
                temperature: this.config.temperature || 0.2,
                top_p: this.config.topP || 0.9
            });

            // Collect streamed response
            let responseText = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                responseText += content;

                if (this.config.verbose) {
                    process.stdout.write(content);
                }
            }

            if (this.config.verbose) {
                console.log('\n');
            }

            return this.parseResponse(responseText);
        };

        try {
            // Use rate limiter if available
            if (this.rateLimiter) {
                return await this.rateLimiter.execute(apiCall, 'Cerebras API');
            } else {
                return await apiCall();
            }
        } catch (error) {
            console.error('❌ Cerebras API error:', error.message);

            // Return a safe fallback action
            return {
                action_type: 'terminate',
                reasoning: `LLM API error: ${error.message}`,
                errors: [error.message]
            };
        }
    }

    /**
     * Get model info for logging
     */
    getModelInfo() {
        return {
            provider: 'Cerebras',
            model: this.model,
            adapter: this.name
        };
    }
}

module.exports = { CerebrasAdapter };
