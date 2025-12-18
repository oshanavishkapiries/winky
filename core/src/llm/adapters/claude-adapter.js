/**
 * Anthropic Claude LLM Adapter
 * Implementation of BaseLLMAdapter for Anthropic Claude
 */
const Anthropic = require('@anthropic-ai/sdk').default;
const { BaseLLMAdapter } = require('./base-adapter');

class ClaudeAdapter extends BaseLLMAdapter {
    constructor(config) {
        super(config);
        this.name = 'claude';
        
        this.client = new Anthropic({
            apiKey: config.apiKey
        });
        
        this.model = config.model || 'claude-3-haiku-20240307';
    }

    async generateAction(context) {
        const prompt = this.buildPrompt(context);
        
        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: this.config.maxTokens || 4096,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                system: 'You are a browser automation agent. Always respond with valid JSON only.'
            });

            const responseText = response.content[0]?.text || '';
            
            if (this.config.verbose) {
                console.log(`  [claude] ${responseText.substring(0, 100)}...`);
            }
            
            return this.parseResponse(responseText);
        } catch (error) {
            console.error(`  [error] Claude API: ${error.message}`);
            
            return {
                action_type: 'terminate',
                reasoning: `LLM API error: ${error.message}`,
                errors: [error.message]
            };
        }
    }

    getModelInfo() {
        return {
            provider: 'Anthropic',
            model: this.model,
            adapter: this.name
        };
    }
}

module.exports = { ClaudeAdapter };
