const fs = require('fs');
const path = require('path');

/**
 * Saves chat messages to a timestamped markdown file for debugging purposes.
 * @param {Array} messages - The input messages sent to the LLM.
 * @param {Object} responseMessage - The response message received from the LLM.
 */
function saveChatLog(messages, responseMessage) {
  try {
    const timestamp = Date.now();
    const chatDir = path.join(process.cwd(), 'data', 'chat');

    if (!fs.existsSync(chatDir)) {
      fs.mkdirSync(chatDir, { recursive: true });
    }

    const filePath = path.join(chatDir, `${timestamp}.md`);
    let mdContent = `# Chat Log - ${new Date(timestamp).toISOString()}\n\n`;

    mdContent += `## Input Messages\n\n`;
    messages.forEach((msg, index) => {
      mdContent += `### Message ${index + 1} (${msg.role})\n${msg.content || '*(No content, possibly tool call/result)*'}\n\n`;

      if (msg.tool_calls) {
        mdContent += `**Tool Calls:**\n` + "```json\n" + JSON.stringify(msg.tool_calls, null, 2) + "\n```\n\n";
      }
    });

    mdContent += `## Response Message\n\n### ${responseMessage.role}\n${responseMessage.content || '*(No content)*'}\n\n`;
    
    if (responseMessage.tool_calls) {
      mdContent += `**Tool Calls:**\n` + "```json\n" + JSON.stringify(responseMessage.tool_calls, null, 2) + "\n```\n\n";
    }

    fs.writeFileSync(filePath, mdContent);
  } catch (error) {
    console.error("Failed to save chat log:", error.message);
  }
}

module.exports = {
  saveChatLog
};
