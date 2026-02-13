const { chromium } = require('playwright');
const fs = require('fs');
const { filterAccessibilityTree, convertToMarkdown } = require('./accessibility-utils');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to your target URL
  await page.goto('https://www.google.com/maps/place/Cinnamon+Grand+Colombo/@6.9413085,79.8031949,14z/data=!4m12!1m2!2m1!1sHotels!3m8!1s0x3ae259be2c6291d3:0xe9d61ae167b8738c!5m2!4m1!1i2!8m2!3d6.9177893!4d79.8484788!16s%2Fg%2F11h6t_l3f6?entry=ttu&g_ep=EgoyMDI2MDIxMC4wIKXMDSoASAFQAw%3D%3D'); 

  const client = await page.context().newCDPSession(page);
  const { nodes } = await client.send('Accessibility.getFullAXTree');

  // 1. Filter the nodes first
  const optimizedNodes = filterAccessibilityTree(nodes);

  // 2. Convert to Markdown format
  const markdownContent = convertToMarkdown(optimizedNodes);

  // 3. Save as .md file
  const timestamp = Date.now();
  const filename = `tree-${timestamp}.md`;
  fs.writeFileSync(filename, markdownContent);

  console.log(`Markdown saved to: ${filename}`);
  console.log(`Token-friendly tree generated with ${optimizedNodes.length} nodes.`);

  await browser.close();
})();