/**
 * ActionVerifier - Verifies if actions caused expected changes
 * Helps detect failed actions and provides feedback to LLM
 */

class ActionVerifier {
    constructor(page) {
        this.page = page;
        this.lastUrl = null;
        this.lastContentHash = null;
        this.lastElementCount = 0;
    }

    /**
     * Capture current page state before action
     */
    async captureState() {
        this.lastUrl = this.page.url();
        this.lastElementCount = await this.getInteractiveElementCount();
        this.lastContentHash = await this.getContentHash();

        return {
            url: this.lastUrl,
            elementCount: this.lastElementCount,
            contentHash: this.lastContentHash
        };
    }

    /**
     * Verify if action caused changes
     * @param {string} actionType - Type of action performed
     * @returns {Object} - Verification result
     */
    async verify(actionType) {
        await this.page.waitForTimeout(500); // Brief wait for changes

        const currentUrl = this.page.url();
        const currentElementCount = await this.getInteractiveElementCount();
        const currentContentHash = await this.getContentHash();

        const changes = {
            urlChanged: currentUrl !== this.lastUrl,
            elementCountChanged: currentElementCount !== this.lastElementCount,
            contentChanged: currentContentHash !== this.lastContentHash,
            newUrl: currentUrl,
            elementDelta: currentElementCount - this.lastElementCount
        };

        // Determine if action likely succeeded based on expected changes
        const verification = this.evaluateChanges(actionType, changes);

        return {
            ...changes,
            ...verification
        };
    }

    /**
     * Evaluate if changes match expected outcome for action type
     */
    evaluateChanges(actionType, changes) {
        const { urlChanged, elementCountChanged, contentChanged } = changes;
        const anyChange = urlChanged || elementCountChanged || contentChanged;

        switch (actionType) {
            case 'click':
                // Click should usually cause some change
                return {
                    likely_succeeded: anyChange,
                    message: anyChange
                        ? `Click caused changes${urlChanged ? ' (navigated)' : ''}`
                        : 'Click may have failed - no visible changes'
                };

            case 'input_text':
                // Input might not change page state immediately
                return {
                    likely_succeeded: true,
                    message: 'Text entered'
                };

            case 'goto_url':
                return {
                    likely_succeeded: urlChanged,
                    message: urlChanged
                        ? `Navigated to new page`
                        : 'Navigation may have failed - URL unchanged'
                };

            case 'scroll':
                return {
                    likely_succeeded: true,
                    message: 'Scroll action executed'
                };

            case 'keypress':
                return {
                    likely_succeeded: true,
                    message: anyChange
                        ? 'Keypress caused changes'
                        : 'Keypress executed'
                };

            default:
                return {
                    likely_succeeded: true,
                    message: 'Action executed'
                };
        }
    }

    /**
     * Get count of interactive elements on page
     */
    async getInteractiveElementCount() {
        try {
            return await this.page.evaluate(() => {
                return document.querySelectorAll(
                    'a, button, input, select, textarea, [role="button"], [onclick]'
                ).length;
            });
        } catch {
            return 0;
        }
    }

    /**
     * Get simple hash of page content for change detection
     */
    async getContentHash() {
        try {
            return await this.page.evaluate(() => {
                const text = document.body?.innerText?.substring(0, 1000) || '';
                let hash = 0;
                for (let i = 0; i < text.length; i++) {
                    hash = ((hash << 5) - hash) + text.charCodeAt(i);
                    hash |= 0;
                }
                return hash;
            });
        } catch {
            return 0;
        }
    }

    /**
     * Generate feedback message for LLM
     */
    generateFeedback(actionType, verification) {
        if (!verification.likely_succeeded) {
            return `⚠️ ACTION FEEDBACK: ${verification.message}. Consider trying a different approach.`;
        }

        let feedback = `✓ ${verification.message}`;
        if (verification.urlChanged) {
            feedback += ` | New URL: ${verification.newUrl.substring(0, 50)}`;
        }
        if (verification.elementDelta !== 0) {
            feedback += ` | Elements: ${verification.elementDelta > 0 ? '+' : ''}${verification.elementDelta}`;
        }

        return feedback;
    }
}

module.exports = { ActionVerifier };
