/**
 * Click Action Plugin
 */
const { BaseAction } = require('../base-action');

class ClickAction extends BaseAction {
    static type = 'click';
    static requiresElement = true;
    static description = 'Click on an element';

    async execute({ element_id }) {
        let element;
        try {
            element = await this.getElement(element_id);
        } catch (error) {
            return { success: false, error: `Element detection failed: ${error.message}` };
        }

        const maxRetries = 3;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                // progressive strategy
                if (i === 0) {
                    await element.click({ timeout: 5000 });
                } else if (i === 1) {
                    console.log(`  [click] Retry 1: Force click on ${element_id}`);
                    await element.click({ force: true, timeout: 5000 });
                } else {
                    console.log(`  [click] Retry 2: JS Dispatch click on ${element_id}`);
                    await element.evaluate(el => el.click());
                }

                return { success: true };
            } catch (error) {
                lastError = error;
                // Wait briefly before retry
                await this.page.waitForTimeout(500);
            }
        }

        return { success: false, error: `Click failed after ${maxRetries} attempts: ${lastError.message}` };
    }
}

module.exports = ClickAction;
