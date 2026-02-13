const fs = require('fs');

// Utility to filter and optimize nodes
function filterAccessibilityTree(nodes) {
  return nodes
    .filter(node => !node.ignored && node.role?.value !== 'none')
    .map(node => ({
      nodeId: node.nodeId,
      role: node.role?.value || "none",
      name: node.name?.value || "",
      description: node.description?.value || "",
      parentId: node.parentId || null,
      backendDOMNodeId: node.backendDOMNodeId
    }));
}

function convertToMarkdown(nodes) {
  let output = "## Page Snapshot\n\n";
  nodes.forEach(node => {
    const interactiveRoles = ["link", "button", "input", "combobox", "textbox", "search", "listbox", "checkbox", "radio"];
    if (node.name || interactiveRoles.includes(node.role)) {
      output += `- role: ${node.role}\n`;
      output += `  name: "${node.name}"\n`;
      output += `  ref: "${node.nodeId}"\n`;
      if (node.description) output += `  description: "${node.description}"\n`;
      output += `\n`;
    }
  });
  return output;
}

/**
 * Captures the tree and returns markdown + a mapping of nodeId to backendDOMNodeId
 */
async function getWebSnapshot(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');
  const { nodes } = await client.send('Accessibility.getFullAXTree');
  
  const mapping = {};
  nodes.forEach(node => {
    if (node.backendDOMNodeId) {
      mapping[node.nodeId] = node.backendDOMNodeId;
    }
  });

  const optimizedNodes = filterAccessibilityTree(nodes);
  const markdown = convertToMarkdown(optimizedNodes);

  return { markdown, mapping };
}

module.exports = { 
  getWebSnapshot,
  filterAccessibilityTree,
  convertToMarkdown
};
