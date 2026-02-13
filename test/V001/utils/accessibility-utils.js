
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
 * Captures the tree AND injects IDs into the DOM so Playwright can find them.
 */
async function getWebSnapshot(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');

  const { nodes } = await client.send('Accessibility.getFullAXTree');

  for (const node of nodes) {
    if (node.backendDOMNodeId && !node.ignored) {
      try {
        const { nodeId: internalDOMNodeId } = await client.send('DOM.requestNode', { 
          backendNodeId: node.backendDOMNodeId 
        });
        
        await client.send('DOM.setAttributeValue', {
          nodeId: internalDOMNodeId,
          name: 'data-backend-node-id',
          value: node.nodeId.toString()
        });
      } catch (err) {
        // Silently fail for nodes that aren't reachable or don't support attributes
      }
    }
  }

  const optimizedNodes = filterAccessibilityTree(nodes);
  return convertToMarkdown(optimizedNodes);
}

module.exports = {
  getWebSnapshot,
  filterAccessibilityTree,
  convertToMarkdown
};