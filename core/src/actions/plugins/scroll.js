/**
 * Scroll Action Plugin
 */
const { BaseAction } = require('../base-action');

class ScrollAction extends BaseAction {
    static type = 'scroll';
    static requiresElement = false;
    static description = 'Scroll the page up, down, or to an element';
    static inputSchema = {
        type: 'object',
        properties: {
            direction: {
                type: 'string',
                description: 'Scroll direction (up, down, top, bottom)',
                default: 'down'
            },
            amount: {
                type: 'number',
                description: 'Amount to scroll in pixels',
                default: 500
            },
            element_id: {
                type: 'string',
                description: 'Optional element UUID to scroll into view'
            }
        }
    };

    async execute({ direction, amount, element_id }) {
        try {
            // If element specified, scroll to it
            if (element_id) {
                const element = await this.getElement(element_id);
                await element.scrollIntoViewIfNeeded();
                return { success: true };
            }

            // Scroll by direction
            const scrollAmount = amount || 500;
            const scrollMap = {
                'up': -scrollAmount,
                'down': scrollAmount,
                'top': 'top',
                'bottom': 'bottom'
            };

            const scroll = scrollMap[direction?.toLowerCase()] || scrollAmount;

            if (scroll === 'top') {
                await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
            } else if (scroll === 'bottom') {
                await this.page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
            } else {
                await this.page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), scroll);
            }

            // Wait for scroll to complete visually
            await this.page.waitForTimeout(500);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = ScrollAction;
