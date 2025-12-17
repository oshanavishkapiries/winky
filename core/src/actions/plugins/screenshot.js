/**
 * ScreenshotAction - Capture visible page area
 */
const { BaseAction } = require('../base-action');
const fs = require('fs');
const path = require('path');

class ScreenshotAction extends BaseAction {
    static type = 'screenshot';
    static requiresElement = false;
    static description = 'Take a screenshot of the current page and save it to the logs.';
    static inputSchema = {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Optional name for the screenshot file'
            },
            fullPage: {
                type: 'boolean',
                description: 'Take full page screenshot',
                default: false
            }
        }
    };

    /**
     * Execute screenshot action
     * @param {Object} action - The action object
     * @returns {Promise<Object>} Execution result
     */
    async execute(action) {
        try {
            // Determine screenshot path
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const dataDir = process.env.DATA_DIR
                ? path.resolve(process.env.DATA_DIR)
                : path.join(__dirname, '..', '..', '..', '..', 'data');

            const screenshotDir = path.join(dataDir, 'screenshots');

            // Ensure directory exists
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }

            const filename = `screenshot-${timestamp}.png`;
            const filepath = path.join(screenshotDir, filename);

            // Capture screenshot
            await this.page.screenshot({
                path: filepath,
                fullPage: false // Capture viewport only for visual relevance
            });

            return {
                success: true,
                message: `Screenshot saved to ${filename}`,
                data: {
                    filepath,
                    filename
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `Screenshot failed: ${error.message}`
            };
        }
    }
}

module.exports = ScreenshotAction;
