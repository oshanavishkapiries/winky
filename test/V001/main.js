// main.js
const { chromium } = require('playwright');
const OllamaAdapter = require('./adapters/ollama-adapter');
const { browserTools, toolDefinitions } = require('./tools/browser-tools');
const LLMBrain = require('./brain');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.google.com');

  const adapter = new OllamaAdapter('llama3.1:8b'); // Or your preferred model
  const brain = new LLMBrain(adapter, browserTools(page), toolDefinitions);

  const result = await brain.execute("Search for 'Playwright automation' and click the first result", page);
  console.log("Agent finished:", result);
})();