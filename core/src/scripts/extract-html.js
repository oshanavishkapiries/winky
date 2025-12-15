const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const chromePath =
    'C:/Program Files/Google/Chrome/Application/chrome.exe';

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
  await page.goto('https://www.amazon.sg/', {
    waitUntil: 'domcontentloaded',
  });
  const html = await page.content();

  fs.writeFileSync('page-structure.html', html);

  console.log('[done] saved page-structure.html');

  await browser.close();
})();
