/**
 * BaseAction - Abstract base class for all action plugins
 * All action plugins must extend this class
 */

class BaseAction {
    // Static metadata - override in subclasses
    static type = 'unknown';
    static requiresElement = false;
    static isCoordinate = false;
    static isTerminal = false;
    static description = 'Base action';

    constructor(page, elementMap = {}) {
        this.page = page;
        this.elementMap = elementMap;
    }

    /**
     * Execute the action - must be implemented by subclasses
     * @param {Object} params - Action parameters
     * @returns {Promise<{success: boolean, error?: string, data?: any}>}
     */
    async execute(params) {
        throw new Error(`execute() not implemented for ${this.constructor.type}`);
    }

    /**
     * Get element by UUID from element map
     * @param {string} elementId
     * @returns {Promise<ElementHandle>}
     */
    async getElement(elementId) {
        if (!elementId) {
            throw new Error('Element ID is required');
        }

        const elementInfo = this.elementMap[elementId];
        if (!elementInfo) {
            throw new Error(`Element ${elementId} not found in map`);
        }

        let element = null;

        // 1. Primary method: Semantic Locator (from Accessibility Tree)
        if (elementInfo.locator) {
            try {
                const { role, name } = elementInfo.locator;
                // Map generic roles or handle edge cases if needed
                if (role && name) {
                    element = this.page.getByRole(role, { name, exact: true }).first();

                    // Verify it matches (count > 0)
                    if (await element.count() === 0) {
                        // Try non-exact match
                        element = this.page.getByRole(role, { name, exact: false }).first();
                    }

                    if (await element.count() > 0) {
                        return element;
                    }
                }
            } catch (e) {
                console.log(`  [BaseAction] Semantic locator failed for ${elementId}: ${e.message}`);
            }
        }

        // 2. Secondary method: XPath (Legacy / Fallback)
        if (elementInfo.xpath) {
            try {
                // Use evaluate for XPath
                const locator = this.page.locator(`xpath=${elementInfo.xpath}`).first();
                if (await locator.count() > 0) {
                    return locator;
                }
            } catch (e) {
                // XPath might be invalid or element not found
            }
        }

        // 3. Fallback: Try by common attributes
        if (!element && elementInfo.name) {
            element = this.page.locator(`[name="${elementInfo.name}"]`).first();
        }
        if (!element && elementInfo['aria-label']) {
            element = this.page.getByLabel(elementInfo['aria-label']).first();
        }
        if (!element && elementInfo.placeholder) {
            element = this.page.getByPlaceholder(elementInfo.placeholder).first();
        }

        if (!element || await element.count() === 0) {
            throw new Error(`Could not locate element: ${elementId}`);
        }

        return element;
    }

    /**
     * Get element center coordinates
     * @param {string} elementId
     * @returns {Promise<{x: number, y: number}>}
     */
    async getElementCenter(elementId) {
        const element = await this.getElement(elementId);
        const box = await element.boundingBox();

        if (!box) {
            throw new Error(`Element ${elementId} has no bounding box`);
        }

        return {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2
        };
    }

    /**
     * Log action (can be overridden)
     * @param {string} message
     */
    log(message) {
        console.log(`  [${this.constructor.type}] ${message}`);
    }
}

module.exports = { BaseAction };
