/**
 * PageStateExtractor - Extracts and simplifies page state (Single Responsibility)
 */
const fs = require('fs');
const path = require('path');


class PageStateExtractor {
    constructor(browserManager, options = {}) {
        this.browserManager = browserManager;
        this.tempDir = options.tempDir || path.join(__dirname, '..', 'data', 'temp');
        this.silent = options.silent || false;
    }

    /**
     * Wait for page to be stable
     */
    async waitForStable() {
        await this.browserManager.waitForStable();
    }

    /**
     * Get the current page state (simplified HTML + element map)
     * @param {string} sessionId - Session ID for temp file naming
     * @returns {Promise<Object>}
     */
    async getState(sessionId) {
        // Wait for page stability
        await this.waitForStable();

        const page = this.browserManager.getPage();
        console.log('DEBUG: Page keys:', Object.keys(page));
        console.log('DEBUG: accessibility namespace:', page.accessibility); // Should be object
        const url = page.url();

        // Capture Accessibility Tree
        let snapshot = null;
        try {
            snapshot = await page.accessibility.snapshot({ interestingOnly: false });
        } catch (e) {
            console.error('Failed to get accessibility snapshot:', e);
            snapshot = { role: 'WebArea', name: 'Error capturing tree', children: [] };
        }

        // Convert to simplified format for LLM
        const { treeString, elementMap } = this.processAxTree(snapshot);

        return {
            url,
            simplifiedHtml: treeString, // Storing AX tree in 'simplifiedHtml' field to keep Agent interface compatible for now
            elementMap,
            elementCount: Object.keys(elementMap).length
        };
    }

    /**
     * Process AX Tree into LLM-friendly string and locator map
     */
    processAxTree(snapshot) {
        const elementMap = {};
        let axIdCounter = 0;
        const lines = [];

        const processNode = (node, depth = 0) => {
            if (!node) return;

            const indent = '  '.repeat(depth);

            // Skip generic containers if they have no name/value
            // Keep generic containers if they have children (preserving structure)
            const isGeneric = !node.role || node.role === 'generic' || node.role === 'WebArea';
            const hasContent = node.name || node.value || node.description;

            // Generate ID for interactive elements
            let axId = null;
            if (this.isInteractive(node)) {
                axId = `ax-${++axIdCounter}`;
                // Store locator info
                elementMap[axId] = {
                    role: node.role,
                    name: node.name,
                    description: node.description,
                    value: node.value,
                    checked: node.checked,
                    disabled: node.disabled,
                    expanded: node.expanded,
                    // We will rely on semantic locators in the executor
                    locator: {
                        role: node.role,
                        name: node.name
                    }
                };
            }

            // Build string representation
            if (!isGeneric || hasContent) {
                let nodeStr = `${indent}- `;
                if (axId) nodeStr += `[${axId}] `;

                if (node.role) nodeStr += `[${node.role}] `;
                if (node.name) nodeStr += `"${node.name}" `;
                if (node.value) nodeStr += `(value: ${node.value}) `;
                if (node.checked) nodeStr += `(checked) `;
                if (node.disabled) nodeStr += `(disabled) `;
                if (node.description) nodeStr += `desc: "${node.description}"`;

                lines.push(nodeStr);
            }

            if (node.children) {
                for (const child of node.children) {
                    processNode(child, depth + 1);
                }
            }
        };

        processNode(snapshot);
        return { treeString: lines.join('\n'), elementMap };
    }

    isInteractive(node) {
        if (node.disabled) return false;

        const interactiveRoles = [
            'button', 'link', 'checkbox', 'radio', 'textbox', 'combobox',
            'searchbox', 'slider', 'tab', 'menuitem', 'switch'
        ];

        return interactiveRoles.includes(node.role) ||
            (node.role === 'generic' && node.onclick); // approximations
    }
}

module.exports = { PageStateExtractor };
