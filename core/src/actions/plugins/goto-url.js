/**
 * Goto URL Action Plugin
 */
const { BaseAction } = require('../base-action');

class GotoUrlAction extends BaseAction {
    static type = 'goto_url';
    static requiresElement = false;
    static description = 'Navigate to a URL';
    static inputSchema = {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to navigate to'
            }
        },
        required: ['url']
    };

    async execute({ url }) {
        try {
            if (!url) {
                return { success: false, error: 'URL is required' };
            }

            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = GotoUrlAction;
