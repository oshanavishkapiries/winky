/**
 * LLM Module Index
 * Export all LLM adapters and utilities
 */
const { config, validateConfig } = require('./config');
const { BaseLLMAdapter } = require('./base-adapter');
const { GeminiAdapter } = require('./adapters/gemini-adapter');
const { CerebrasAdapter } = require('./adapters/cerebras-adapter');
const { OllamaAdapter } = require('./adapters/ollama-adapter');
const { OpenRouterAdapter } = require('./adapters/openrouter-adapter');

/**
 * Create an LLM adapter based on provider name
 * @param {string} provider - Provider name ('gemini', 'cerebras', 'ollama', 'openrouter')
 * @returns {BaseLLMAdapter} - LLM adapter instance
 */
function createAdapter(provider = 'gemini') {
    validateConfig(provider);

    switch (provider.toLowerCase()) {
        case 'gemini':
            return new GeminiAdapter(config.gemini);
        case 'cerebras':
            return new CerebrasAdapter(config.cerebras);
        case 'ollama':
            return new OllamaAdapter(config.ollama);
        case 'openrouter':
            return new OpenRouterAdapter(config.openrouter);
        default:
            throw new Error(`Unknown LLM provider: ${provider}`);
    }
}

module.exports = {
    config,
    validateConfig,
    BaseLLMAdapter,
    GeminiAdapter,
    CerebrasAdapter,
    OllamaAdapter,
    OpenRouterAdapter,
    createAdapter
};
