const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { BrowserManager } = require('../browser/browser-manager');
const { PageStateExtractor } = require('../browser/page-state-extractor');

(async () => {
    console.log('--- TEST: Accessibility Tree Extraction (Integration) ---');
    console.log('Chrome Path:', process.env.CHROME_PATH);

    const browserManager = new BrowserManager({
        headless: true,
        chromePath: process.env.CHROME_PATH
    });

    try {
        await browserManager.launch();
        const extractor = new PageStateExtractor(browserManager);

        console.log('Navigating to Google...');
        await browserManager.goto('https://google.com');

        console.log('Extracting state...');
        const state = await extractor.getState('test-session');

        console.log('\n--- AX TREE OUTPUT ---');
        console.log(state.simplifiedHtml.substring(0, 500) + '... [truncated]');

        console.log('\n--- LOCATOR MAP (First 3) ---');
        const keys = Object.keys(state.elementMap).slice(0, 3);
        keys.forEach(k => {
            console.log(`${k}:`, state.elementMap[k]);
        });

        if (state.elementCount > 0 && state.simplifiedHtml.length > 0) {
            console.log('\n✅ SUCCESS: AX Tree extracted via PageStateExtractor.');
        } else {
            console.error('\n❌ FAILURE: AX Tree empty.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (browserManager.isRunning()) {
            await browserManager.close();
        }
    }
})();
