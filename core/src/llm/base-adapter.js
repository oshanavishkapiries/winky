/**
 * Base LLM Adapter
 * Abstract interface for LLM providers
 * Extend this class to add support for different LLMs
 */

const { RateLimiter } = require('./rate-limiter');
const { config: globalConfig } = require('./config');

class BaseLLMAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'base';

    // Initialize rate limiter if enabled
    if (globalConfig.rateLimit.enabled) {
      this.rateLimiter = new RateLimiter({
        requestsPerMinute: globalConfig.rateLimit.requestsPerMinute,
        requestsPerDay: globalConfig.rateLimit.requestsPerDay,
        minDelayMs: globalConfig.rateLimit.minDelayMs,
        maxRetries: globalConfig.rateLimit.maxRetries,
        retryDelayMs: globalConfig.rateLimit.retryDelayMs,
        retryMultiplier: globalConfig.rateLimit.retryMultiplier
      });
    } else {
      this.rateLimiter = null;
    }
  }

  /**
   * Generate next action from LLM
   * @param {Object} context - Current context
   * @param {string} context.goal - User's goal
   * @param {string} context.simplifiedHtml - Simplified HTML of current page
   * @param {Object} context.elementMap - UUID to element info mapping
   * @param {Array} context.previousActions - List of previous actions taken
   * @param {string} context.currentUrl - Current page URL
   * @returns {Promise<Object>} - Action object from LLM
   */
  async generateAction(context) {
    throw new Error('generateAction must be implemented by subclass');
  }

  /**
   * Build the prompt for the LLM
   * @param {Object} context - Current context
   * @returns {string} - Formatted prompt
   */
  buildPrompt(context) {
    const { goal, simplifiedHtml, elementMap, previousActions, currentUrl, memoryContext, stepContext, loopProgress } = context;

    const actionsHistory = previousActions?.length > 0
      ? previousActions.map((a, i) => `${i + 1}. ${a.action_type}: ${a.reasoning}`).join('\n')
      : 'No actions taken yet.';

    const elementInfo = Object.entries(elementMap || {})
      .slice(0, 100)
      .map(([uuid, info]) => `${uuid}: ${info.tag}${info.text ? ` "${info.text.substring(0, 50)}"` : ''}`)
      .join('\n');

    // Build memory section if available
    let memorySection = '';
    if (stepContext) {
      memorySection += `\n## Current Task\n${stepContext}\n`;
    }
    if (loopProgress && loopProgress.target > 0) {
      memorySection += `\n## Loop Progress\nCompleted: ${loopProgress.current}/${loopProgress.target} | Remaining: ${loopProgress.remaining}\n`;
    }
    if (memoryContext) {
      memorySection += `\n## Agent Memory\n${memoryContext}\n`;
    }

    return `You are a browser automation agent. Your task is to interact with web pages to achieve the user's goal AND intelligently extract useful data.

## Current URL
${currentUrl || 'Unknown'}

## User's Goal
${goal}
${memorySection}
## Previous Actions
${actionsHistory}

## Available Interactive Elements (UUID: element_type "text")
${elementInfo}

## Current Page HTML (Simplified)
\`\`\`html
${simplifiedHtml?.substring(0, 15000) || 'No HTML available'}
\`\`\`

## Available Actions

### Element-based actions
- click: Click element. Requires: element_id
- input_text: Type into input. Requires: element_id, text. Optional: press_enter (auto-detected for search inputs)
- select_option: Select dropdown. Requires: element_id, option
- hover: Hover element. Requires: element_id

### Keyboard actions
- type_text: Simulate typing. Requires: text
- keypress: Press keys. Requires: keys (array)

### Navigation actions
- scroll: Scroll page. Requires: direction, amount
- goto_url: Navigate. Requires: url
- go_back / go_forward / reload

### Control actions
- wait: Wait seconds. Requires: seconds

### Data Extraction & Completion
- extract: Extract data from page and continue. Use when you find useful data mid-task.
- complete: Task done. Use when goal is achieved.
- terminate: Cannot complete. Use when goal is impossible.

## IMPORTANT: Complex Page Navigation Tips

### Sites with Side Panels (Google Maps, Gmail, Airbnb, etc.)
- When clicking an item opens a DETAILS PANEL on the right/left side, look for:
  - Back arrow button (←) to return to list
  - Close button (X) to close panel
  - Or click outside the panel to dismiss it
- The main list may be in a SCROLLABLE CONTAINER - scroll within it using element_id
- If you can't see more items, scroll DOWN within the list panel, not the whole page

### Iterative Extraction Pattern (e.g., "extract 5 items", "do this 5 times")
Follow this EXACT pattern:
1. Click item from list → Details panel opens
2. Extract data (name, price, etc.) from the details panel
3. Click BACK/CLOSE to return to the list  
4. Scroll if needed to reveal next item
5. Click NEXT item → Repeat until target count reached
6. Use "complete" action only after extracting ALL requested items

### Troubleshooting
- If clicking doesn't work: Element may be obscured. Try scrolling first.
- If element not found: Page may need scrolling to reveal it.
- If stuck in loop: Try a different approach (back button, scroll, different element).
- If panel covers list: Close the panel first before clicking another item.

## SMART DATA EXTRACTION RULES

You MUST extract data when:
1. User asks for information (products, prices, listings, search results)
2. You navigate to a relevant page with useful content
3. The current page contains data that answers the user's goal

**Choose output format based on content:**

### Use JSON format (output_format: "json") for:
- Product listings with prices, names, ratings
- Search results with multiple items
- Tables or structured data
- API-like data (lists of items with properties)

### Use Markdown format (output_format: "markdown") for:
- Summaries or reports
- Step-by-step guides found on page
- Article content or descriptions
- Mixed content with text and formatting

## Response Format
\`\`\`json
{
  "reasoning": "Your step-by-step reasoning",
  "action_type": "the action type",
  "element_id": "uuid-X (if needed)",
  "text": "text to type (if needed)",
  "keys": ["Enter"],
  "direction": "down",
  "amount": 300,
  "seconds": 2,
  "output_format": "json or markdown (for extract/complete)",
  "output_title": "Title for the output file",
  "extracted_data": {
    "summary": "Brief description of what was extracted",
    "data": [] or {} or "markdown content"
  }
}
\`\`\`

## Examples

**Extracting product list (JSON):**
\`\`\`json
{
  "reasoning": "Found best selling books. Extracting product data as JSON.",
  "action_type": "complete",
  "output_format": "json",
  "output_title": "best_selling_books",
  "extracted_data": {
    "summary": "Top 10 best selling books from Amazon Singapore",
    "source_url": "https://amazon.sg/bestsellers/books",
    "data": [
      {"rank": 1, "title": "Book Name", "author": "Author", "price": "$19.99", "rating": "4.5"}
    ]
  }
}
\`\`\`

**Extracting summary (Markdown):**
\`\`\`json
{
  "reasoning": "Found relevant information. Creating markdown summary.",
  "action_type": "complete",
  "output_format": "markdown",
  "output_title": "weather_tokyo_report",
  "extracted_data": {
    "summary": "Weather report for Tokyo",
    "data": "# Weather in Tokyo\\n\\n**Current:** 15°C, Cloudy\\n\\n## Forecast\\n- Monday: 18°C\\n- Tuesday: 20°C"
  }
}
\`\`\`

IMPORTANT:
- ALWAYS extract data when the page contains information relevant to user's goal
- Choose the appropriate output format based on content type
- Even if user didn't ask for data output, extract if it would be useful
- Be thorough - extract all relevant fields visible on the page

Respond with ONLY the JSON object, no additional text.`;
  }

  /**
   * Parse LLM response into action object
   * @param {string} response - Raw LLM response
   * @returns {Object} - Parsed action object
   */
  parseResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      console.error('Failed to parse LLM response:', error.message);
      return {
        action_type: 'wait',
        reasoning: 'Failed to parse LLM response, waiting...',
        seconds: 2
      };
    }
  }
}

module.exports = { BaseLLMAdapter };
