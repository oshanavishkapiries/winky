/**
 * Wait Action Plugin
 */
const { BaseAction } = require('../base-action');

class WaitAction extends BaseAction {
    static type = 'wait';
    static requiresElement = false;
    static description = 'Wait for a specified duration in milliseconds';
    static inputSchema = {
        type: 'object',
        properties: {
            duration: {
                type: 'number',
                description: 'Duration in milliseconds',
                default: 1000
            }
        }
    };

    async execute({ duration }) {
        try {
            const waitTime = duration || 1000;
            await this.page.waitForTimeout(waitTime);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = WaitAction;
