const { getWebSnapshot } = require('../utils/accessibility-utils');
const fs = require('fs');
const path = require('path');

let lastMapping = {};

const resolveElement = async (page, ref) => {
  const backendNodeId = lastMapping[ref];
  if (!backendNodeId) throw new Error(`Reference ID ${ref} not found in last snapshot.`);
  
  const client = await page.context().newCDPSession(page);
  const { object } = await client.send('DOM.resolveNode', { backendNodeId });
  const handle = await page.evaluateHandle(obj => obj, object);
  const element = handle.asElement();
  if (!element) throw new Error(`Could not resolve ref ${ref} to a DOM element.`);
  return element;
};

const browserTools = (page) => ({
  snapshot: async () => {
    try {
      const { markdown, mapping } = await getWebSnapshot(page);
      lastMapping = mapping; // Store for subsequent tool calls
      return markdown;
    } catch (error) {
      return `Error capturing snapshot: ${error.message}`;
    }
  },

  click: async ({ ref }) => {
    try {
      const element = await resolveElement(page, ref);
      await element.scrollIntoViewIfNeeded();
      await element.click({ timeout: 5000 });
      return `Successfully clicked on ref ${ref}`;
    } catch (error) {
      return `Failed to click ref ${ref}: ${error.message}. If blocked by an overlay, handle it first.`;
    }
  },

  type_text: async ({ ref, text }) => {
    try {
      const element = await resolveElement(page, ref);
      await element.scrollIntoViewIfNeeded();
      await element.click();
      await element.fill(''); 
      await element.type(text, { delay: 50 });
      return `Successfully typed "${text}" into ref ${ref}`;
    } catch (error) {
      return `Failed to type into ref ${ref}: ${error.message}`;
    }
  },

  press_key: async ({ key }) => {
    try {
      await page.keyboard.press(key);
      return `Successfully pressed the "${key}" key`;
    } catch (error) {
      return `Failed to press key "${key}": ${error.message}`;
    }
  },

  scroll: async ({ direction, ref }) => {
    try {
      if (ref) {
        const element = await resolveElement(page, ref);
        await element.scrollIntoViewIfNeeded();
        return `Successfully scrolled to ref ${ref}`;
      }
      const distance = direction === 'down' ? 600 : -600;
      await page.mouse.wheel(0, distance);
      return `Successfully scrolled ${direction}`;
    } catch (error) {
      return `Failed to scroll: ${error.message}`;
    }
  },

  evaluate: async ({ script }) => {
    try {
      const result = await page.evaluate(script);
      return `Script executed. Result: ${JSON.stringify(result)}`;
    } catch (error) {
      return `Failed to execute script: ${error.message}`;
    }
  },

  take_screenshot: async () => {
    try {
      const timestamp = Date.now();
      const screenshotDir = path.join(process.cwd(), 'data', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const filePath = path.join(screenshotDir, `${timestamp}.png`);
      await page.screenshot({ path: filePath });
      return `Screenshot saved to ${filePath}. Use this to debug visual blocks or overlays.`;
    } catch (error) {
      return `Failed to take screenshot: ${error.message}`;
    }
  }
});

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'snapshot',
      description: 'Capture the current state of the page. Returns a list of interactive elements with ref IDs.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Click an element using its ref ID.',
      parameters: {
        type: 'object',
        properties: { ref: { type: 'string' } },
        required: ['ref']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Type text into an input field using its ref ID.',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['ref', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'press_key',
      description: 'Press a keyboard key (e.g., "Enter", "Tab", "Escape").',
      parameters: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'Scroll the page or a specific element into view.',
      parameters: {
        type: 'object',
        properties: { 
          direction: { type: 'string', enum: ['up', 'down'] },
          ref: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'evaluate',
      description: 'Execute JavaScript in the page context.',
      parameters: {
        type: 'object',
        properties: { script: { type: 'string' } },
        required: ['script']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'take_screenshot',
      description: 'Take a screenshot for debugging visual issues or overlays.',
      parameters: { type: 'object', properties: {} }
    }
  }
];

module.exports = { browserTools, toolDefinitions };
