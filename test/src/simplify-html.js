const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// ============================================================================
// CONFIGURATION - Based on your diagram + Improvements from Skyvern scraper
// ============================================================================
const CONFIG = {
    // Interactive elements to add IDs to
    interactiveElements: [
        'a',
        'button',
        'input',
        'textarea',
        'select',
        'option',
        'summary',
        'label',
        'details',
        'dialog'
    ],

    // Roles that indicate interactive elements (ARIA widget roles)
    interactiveRoles: [
        'button',
        'link',
        'checkbox',
        'radio',
        'tab',
        'menuitem',
        'menuitemcheckbox',
        'menuitemradio',
        'option',
        'combobox',
        'textbox',
        'searchbox',
        'switch',
        'slider',
        'spinbutton',
        'listbox',
        'menu',
        'treeitem',
        'gridcell'
    ],

    // Tags to completely remove
    tagsToRemove: [
        'script',
        'style',
        'link',
        'meta',
        'noscript',
        'head',
        'base',
        'iframe',
        'svg',
        'canvas',
        'audio',
        'video',
        'template',
        'source',
        'track',
        'embed',
        'object',
        'picture',
        'map',
        'area'
    ],

    // Attributes to KEEP (important for AI/automation understanding)
    attributesToKeep: [
        'id',
        'name',
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'aria-placeholder',
        'aria-valuetext',
        'aria-valuenow',
        'aria-valuemin',
        'aria-valuemax',
        'alt',
        'title',
        'placeholder',
        'label',
        'for',
        'disabled',
        'readonly',
        'required',
        'checked',
        'selected',
        'aria-disabled',
        'aria-readonly',
        'aria-required',
        'aria-checked',
        'aria-selected',
        'aria-expanded',
        'aria-pressed',
        'aria-hidden',
        'aria-current',
        'hidden',
        'open',
        'type',
        'role',
        'inputmode',
        'value',
        'href',
        'src',
        'action',
        'method',
        'min',
        'max',
        'minlength',
        'maxlength',
        'pattern',
        'step',
        'data-uuid'
    ],

    // Attributes that indicate interactivity
    interactiveAttributes: [
        'onclick',
        'onchange',
        'onsubmit',
        'oninput',
        'onfocus',
        'onblur',
        'contenteditable',
        'tabindex',
        'data-action',
        'data-target',
        'ng-click',
        'data-ng-click',
        '@click',
        'v-on:click'
    ],

    // Output directories (relative to project root)
    outputDirs: {
        simplifiedHtml: 'data/simplified-html',
        elementMap: 'data/element-map'
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

let uuidCounter = 0;

/**
 * Generate a timestamp-based ID for file naming
 * Format: YYYYMMDD_HHmmss
 */
function generateTimestampId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function generateUUID() {
    uuidCounter++;
    return `uuid-${uuidCounter}`;
}

/**
 * Get the XPath for an element
 */
function getXPath(element, document) {
    if (!element) return '';

    if (element === document.body) {
        return '/html/body';
    }

    if (element === document.documentElement) {
        return '/html';
    }

    let pathParts = [];
    let current = element;

    while (current && current !== document) {
        let tagName = current.nodeName.toLowerCase();

        if (current.parentNode) {
            let siblings = Array.from(current.parentNode.children).filter(
                sibling => sibling.nodeName.toLowerCase() === tagName
            );

            if (siblings.length > 1) {
                let index = siblings.indexOf(current) + 1;
                tagName += `[${index}]`;
            }
        }

        pathParts.unshift(tagName);
        current = current.parentNode;
    }

    return '/' + pathParts.join('/');
}

/**
 * Ensure output directories exist
 */
function ensureOutputDirs(projectRoot) {
    const dirs = [
        path.join(projectRoot, CONFIG.outputDirs.simplifiedHtml),
        path.join(projectRoot, CONFIG.outputDirs.elementMap)
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    });
}

// ============================================================================
// VISIBILITY & INTERACTABILITY DETECTION
// ============================================================================

function isHiddenElement(element, window) {
    if (element.hidden) {
        return true;
    }

    const ariaHidden = element.getAttribute('aria-hidden');
    if (ariaHidden === 'true') {
        return true;
    }

    const style = element.getAttribute('style') || '';
    if (style.includes('display: none') ||
        style.includes('display:none') ||
        style.includes('visibility: hidden') ||
        style.includes('visibility:hidden')) {
        return true;
    }

    return false;
}

function isDisabledElement(element) {
    if (element.disabled) {
        return true;
    }

    const ariaDisabled = element.getAttribute('aria-disabled');
    if (ariaDisabled === 'true') {
        return true;
    }

    return false;
}

function isReadonlyElement(element) {
    if (element.readOnly) {
        return true;
    }

    if (element.hasAttribute('readonly')) {
        return true;
    }

    const ariaReadonly = element.getAttribute('aria-readonly');
    if (ariaReadonly === 'true') {
        return true;
    }

    return false;
}

function isInteractiveElement(element) {
    const tagName = element.tagName.toLowerCase();

    if (CONFIG.interactiveElements.includes(tagName)) {
        return true;
    }

    const role = element.getAttribute('role');
    if (role && CONFIG.interactiveRoles.includes(role.toLowerCase())) {
        return true;
    }

    if (element.getAttribute('contenteditable') === 'true') {
        return true;
    }

    for (const attr of CONFIG.interactiveAttributes) {
        if (element.hasAttribute(attr)) {
            return true;
        }
    }

    const tabindex = element.getAttribute('tabindex');
    if (tabindex && parseInt(tabindex) >= 0) {
        if (element.textContent.trim() || element.children.length > 0) {
            if (tagName !== 'div' && tagName !== 'span') {
                return true;
            }
        }
    }

    return false;
}

// ============================================================================
// ATTRIBUTE CLEANING
// ============================================================================

function cleanAttributes(element) {
    const attributesToRemove = [];

    for (const attr of element.attributes) {
        const attrName = attr.name.toLowerCase();

        if (CONFIG.attributesToKeep.includes(attrName)) {
            continue;
        }

        if (attrName === 'data-uuid') {
            continue;
        }

        attributesToRemove.push(attr.name);
    }

    attributesToRemove.forEach(attr => element.removeAttribute(attr));
}

function trimLongAttributes(element) {
    const MAX_ATTR_LENGTH = 150;

    for (const attr of element.attributes) {
        if (attr.value && attr.value.length > MAX_ATTR_LENGTH) {
            if (attr.name === 'href' || attr.name === 'src') {
                const url = attr.value;
                const queryIndex = url.indexOf('?');
                if (queryIndex > 0 && url.length > MAX_ATTR_LENGTH) {
                    element.setAttribute(attr.name, url.substring(0, queryIndex) + '?...');
                }
            } else if (attr.name !== 'data-uuid') {
                element.setAttribute(attr.name, attr.value.substring(0, MAX_ATTR_LENGTH) + '...');
            }
        }
    }
}

// ============================================================================
// DOM CLEANING FUNCTIONS
// ============================================================================

function removeComments(node) {
    const nodesToRemove = [];

    const walker = node.ownerDocument.createTreeWalker(
        node,
        128,
        null,
        false
    );

    while (walker.nextNode()) {
        nodesToRemove.push(walker.currentNode);
    }

    nodesToRemove.forEach(commentNode => commentNode.remove());

    return nodesToRemove.length;
}

function cleanWhitespace(document) {
    const walker = document.createTreeWalker(
        document.body,
        4,
        null,
        false
    );

    const nodesToRemove = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.textContent.trim() === '') {
            nodesToRemove.push(node);
        } else {
            node.textContent = node.textContent.replace(/\s+/g, ' ').trim();
        }
    }

    nodesToRemove.forEach(node => node.remove());
}

function removeHiddenElements(document, window) {
    let removedCount = 0;

    const ariaHiddenElements = document.querySelectorAll('[aria-hidden="true"]');
    ariaHiddenElements.forEach(el => {
        const hasInteractiveChild = Array.from(el.querySelectorAll('*')).some(child =>
            isInteractiveElement(child) && !isHiddenElement(child, window)
        );

        if (!hasInteractiveChild) {
            el.remove();
            removedCount++;
        }
    });

    const hiddenElements = document.querySelectorAll('[hidden]');
    hiddenElements.forEach(el => {
        el.remove();
        removedCount++;
    });

    return removedCount;
}

function removeEmptyContainers(document) {
    let removedCount = 0;
    let changed = true;

    while (changed) {
        changed = false;
        const containers = document.querySelectorAll('div, span, section, article, aside, header, footer, main, nav');

        containers.forEach(el => {
            const hasText = el.textContent.trim().length > 0;
            const hasInteractiveChild = Array.from(el.querySelectorAll('*')).some(child =>
                child.hasAttribute('data-uuid')
            );
            const hasImage = el.querySelector('img');

            if (!hasText && !hasInteractiveChild && !hasImage && !el.hasAttribute('data-uuid')) {
                el.remove();
                removedCount++;
                changed = true;
            }
        });
    }

    return removedCount;
}

// ============================================================================
// MAIN SIMPLIFICATION FUNCTION
// ============================================================================

function simplifyHTML(inputPath, options = {}) {
    // Options
    const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
    const silent = options.silent || false;
    const log = silent ? () => { } : console.log.bind(console);
    const logError = silent ? () => { } : console.error.bind(console);

    // Read the input HTML file
    const absolutePath = path.resolve(inputPath);

    if (!fs.existsSync(absolutePath)) {
        logError(`[error] File not found: ${absolutePath}`);
        if (!silent) process.exit(1);
        return null;
    }

    const htmlContent = fs.readFileSync(absolutePath, 'utf8');

    // Parse the HTML using JSDOM
    const virtualConsole = new jsdom.VirtualConsole();
    virtualConsole.on('error', () => { });

    const dom = new JSDOM(htmlContent, { virtualConsole });
    const document = dom.window.document;
    const window = dom.window;

    // Reset UUID counter
    uuidCounter = 0;

    // Element map to store UUID -> XPath mapping
    const elementMap = {};

    // Generate timestamp ID for output files
    const timestampId = generateTimestampId();
    const inputName = path.basename(absolutePath, path.extname(absolutePath));

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 HTML SIMPLIFICATION');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📄 Input: ${path.basename(absolutePath)}`);
    console.log(`🆔 Session ID: ${timestampId}`);
    console.log('───────────────────────────────────────────────────────────\n');

    // ========================================
    // Step 1: Add IDs to interactive elements
    // ========================================
    console.log('📍 Step 1: Adding IDs to interactive elements...');

    const allElements = document.querySelectorAll('*');
    let interactiveCount = 0;
    let hiddenSkipped = 0;
    let disabledMarked = 0;

    allElements.forEach(element => {
        if (isHiddenElement(element, window)) {
            hiddenSkipped++;
            return;
        }

        if (isInteractiveElement(element)) {
            const uuid = generateUUID();
            const xpath = getXPath(element, document);

            const elementInfo = {
                xpath: xpath,
                tag: element.tagName.toLowerCase(),
                role: element.getAttribute('role') || null,
                text: element.textContent.trim().substring(0, 100) || null,
                disabled: isDisabledElement(element),
                readonly: isReadonlyElement(element)
            };

            ['aria-label', 'placeholder', 'name', 'type', 'href', 'value', 'alt', 'title'].forEach(attr => {
                if (element.hasAttribute(attr)) {
                    const value = element.getAttribute(attr);
                    if (value && value.length < 200) {
                        elementInfo[attr] = value;
                    }
                }
            });

            elementMap[uuid] = elementInfo;
            element.setAttribute('data-uuid', uuid);

            if (elementInfo.disabled) disabledMarked++;
            interactiveCount++;
        }
    });

    console.log(`   ✅ Added ${interactiveCount} UUIDs to interactive elements`);
    console.log(`   ⚠️  Skipped ${hiddenSkipped} hidden elements`);
    console.log(`   🚫 Marked ${disabledMarked} disabled elements`);

    // ========================================
    // Step 2: Remove unwanted tags
    // ========================================
    console.log('\n🗑️  Step 2: Removing unwanted elements...');

    let removedCount = 0;
    CONFIG.tagsToRemove.forEach(tagName => {
        const elements = document.querySelectorAll(tagName);
        elements.forEach(el => {
            el.remove();
            removedCount++;
        });
    });

    console.log(`   ✅ Removed ${removedCount} unwanted elements`);

    // ========================================
    // Step 3: Remove hidden elements
    // ========================================
    console.log('\n👻 Step 3: Removing hidden elements...');
    const hiddenRemoved = removeHiddenElements(document, window);
    console.log(`   ✅ Removed ${hiddenRemoved} hidden elements`);

    // ========================================
    // Step 4: Clean attributes
    // ========================================
    console.log('\n🧹 Step 4: Cleaning attributes...');
    const remainingElements = document.querySelectorAll('*');
    remainingElements.forEach(element => {
        cleanAttributes(element);
        trimLongAttributes(element);
    });
    console.log(`   ✅ Cleaned ${remainingElements.length} elements`);

    // ========================================
    // Step 5: Remove HTML comments
    // ========================================
    console.log('\n💬 Step 5: Removing HTML comments...');
    const commentsRemoved = removeComments(document.body);
    console.log(`   ✅ Removed ${commentsRemoved} comments`);

    // ========================================
    // Step 6: Clean whitespace
    // ========================================
    console.log('\n📝 Step 6: Normalizing whitespace...');
    cleanWhitespace(document);
    console.log(`   ✅ Whitespace normalized`);

    // ========================================
    // Step 7: Remove empty containers
    // ========================================
    console.log('\n🧽 Step 7: Removing empty containers...');
    const emptyRemoved = removeEmptyContainers(document);
    console.log(`   ✅ Removed ${emptyRemoved} empty containers`);

    // ========================================
    // Generate Output
    // ========================================

    let simplifiedHTML = document.body ? document.body.innerHTML : document.documentElement.innerHTML;

    simplifiedHTML = simplifiedHTML
        .replace(/>\s+</g, '>\n<')
        .replace(/(<[^>]+>)/g, '\n$1')
        .split('\n')
        .filter(line => line.trim())
        .join('\n');

    const finalHTML = `<!DOCTYPE html>
<html>
<body>
${simplifiedHTML}
</body>
</html>`;

    // Ensure output directories exist
    ensureOutputDirs(projectRoot);

    // Generate output file paths with timestamp ID
    const outputFileName = `${inputName}_${timestampId}`;
    const simplifiedHTMLPath = path.join(projectRoot, CONFIG.outputDirs.simplifiedHtml, `${outputFileName}.html`);
    const elementMapPath = path.join(projectRoot, CONFIG.outputDirs.elementMap, `${outputFileName}.json`);

    // Write outputs
    fs.writeFileSync(simplifiedHTMLPath, finalHTML, 'utf8');
    fs.writeFileSync(elementMapPath, JSON.stringify(elementMap, null, 2), 'utf8');

    // Print results
    console.log('\n───────────────────────────────────────────────────────────');
    console.log('📊 RESULTS');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`✅ Simplified HTML: ${path.relative(projectRoot, simplifiedHTMLPath)}`);
    console.log(`✅ Element Map: ${path.relative(projectRoot, elementMapPath)}`);
    console.log(`📉 Size: ${(htmlContent.length / 1024).toFixed(2)} KB → ${(finalHTML.length / 1024).toFixed(2)} KB (${(((htmlContent.length - finalHTML.length) / htmlContent.length) * 100).toFixed(1)}% reduction)`);
    console.log(`🎯 Interactive elements: ${Object.keys(elementMap).length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    return {
        sessionId: timestampId,
        simplifiedHTML: finalHTML,
        elementMap,
        simplifiedHTMLPath,
        elementMapPath
    };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node src/simplify-html.js <path-to-html-file>');
        console.log('Example: node src/simplify-html.js data/html-pages/s01.html');
        process.exit(1);
    }

    simplifyHTML(args[0]);
}

module.exports = { simplifyHTML, CONFIG };
