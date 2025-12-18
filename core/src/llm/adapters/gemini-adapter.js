/**
 * Gemini LLM Adapter
 * Implementation of BaseLLMAdapter for Google Gemini 2.5 Flash
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { BaseLLMAdapter } = require('./base-adapter');

class GeminiAdapter extends BaseLLMAdapter {
    constructor(config) {
        super(config);
        this.name = 'gemini';

        // Initialize Gemini client
        this.genAI = new GoogleGenerativeAI(config.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config.model,
            generationConfig: config.generationConfig
        });
    }

    /**
     * Generate next action using Gemini
     * @param {Object} context - Current context
     * @returns {Promise<Object>} - Action object
     */
    async generateAction(context) {
        const prompt = this.buildPrompt(context);

        const apiCall = async () => {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            if (this.config.verbose) {
                console.log('\n LLM Response:', text.substring(0, 500) + '...');
            }

            return this.parseResponse(text);
        };

        try {
            // Use rate limiter if available
            if (this.rateLimiter) {
                return await this.rateLimiter.execute(apiCall, 'Gemini API');
            } else {
                return await apiCall();
            }
        } catch (error) {
            console.error('❌ Gemini API error:', error.message);

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
            provider: 'Google',
            model: this.config.model,
            adapter: this.name
        };
    }
}

module.exports = { GeminiAdapter };
