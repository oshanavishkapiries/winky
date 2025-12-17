/**
 * Simple Element Highlighter
 * Just adds a border to elements being actioned
 */

class ElementHighlighter {
    constructor(page) {
        this.page = page;
    }

    /**
     * Inject basic styles
     */
    /**
     * Inject professional styles for overlays and toasts
     */
    async injectStyles() {
        await this.page.addStyleTag({
            content: `
                .agent-highlight {
                    outline: 4px solid #7C3AED !important; /* Violet-600 */
                    outline-offset: 2px;
                    box-shadow: 0 0 0 6px rgba(124, 58, 237, 0.3) !important;
                    transition: all 0.2s ease;
                    z-index: 2147483640 !important;
                }
                
                #agent-toast-container {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 2147483647;
                    font-family: 'Inter', -apple-system, system-ui, sans-serif;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    pointer-events: none;
                }

                .agent-toast {
                    background: rgba(17, 24, 39, 0.95); /* Gray-900 */
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(8px);
                    font-size: 14px;
                    line-height: 1.5;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    max-width: 320px;
                }

                .agent-toast-icon {
                    font-size: 18px;
                }
                
                .agent-toast-content {
                    font-weight: 500;
                }

                @keyframes toast-slide-in {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `
        });
    }

    /**
     * Show a toast notification
     * @param {string} message
     * @param {string} type - 'info', 'success', 'warning', 'error', 'action'
     */
    async showToast(message, type = 'info') {
        const icons = {
            info: '🤖',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            action: '⚡'
        };

        await this.page.evaluate(({ msg, icon }) => {
            let container = document.getElementById('agent-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'agent-toast-container';
                document.body.appendChild(container);
            }

            // Remove old toasts
            while (container.children.length > 2) {
                container.removeChild(container.firstChild);
            }

            const toast = document.createElement('div');
            toast.className = 'agent-toast';
            toast.innerHTML = `
                <span class="agent-toast-icon">${icon}</span>
                <span class="agent-toast-content">${msg}</span>
            `;

            container.appendChild(toast);

            // Auto remove after 5s
            setTimeout(() => {
                if (toast.isConnected) toast.remove();
            }, 5000);
        }, { msg: message, icon: icons[type] || icons.info });
    }

    /**
     * Highlight element by mapping info
     */
    async highlightAction(uuid, actionType, elementInfo = {}) {
        try {
            // Find element handle using same logic as BaseAction
            let element = null;

            if (elementInfo.locator) {
                const { role, name } = elementInfo.locator;
                if (role && name) {
                    element = this.page.getByRole(role, { name, exact: false }).first();
                }
            }

            if (!element && elementInfo.xpath) {
                element = this.page.locator(`xpath=${elementInfo.xpath}`).first();
            }

            if (!element && elementInfo.name) {
                element = this.page.locator(`[name="${elementInfo.name}"]`).first();
            }

            if (element && await element.count() > 0) {
                await this.clearAll();

                // Add highlight class
                await element.evaluate(el => {
                    el.classList.add('agent-highlight');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });

                // Show action toast
                await this.showToast(`${actionType}: ${elementInfo.name || elementInfo.locator?.name || 'element'}`, 'action');
            }
        } catch (e) {
            console.error('Highlight failed:', e);
        }
    }

    /**
     * Clear all highlights
     */
    async clearAll() {
        await this.page.evaluate(() => {
            document.querySelectorAll('.agent-highlight').forEach(el => {
                el.classList.remove('agent-highlight');
            });
        });
    }

    // Stub methods for compatibility
    async updateStatusPanel(step, action, id, target) {
        // Optional: Implement persistent status panel if needed
    }
}

module.exports = { ElementHighlighter };
