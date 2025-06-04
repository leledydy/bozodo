const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log("🧠 Visiting your AI page...");
    await page.goto('https://your-project.up.railway.app', {
      waitUntil: 'load',
      timeout: 60000
    });

    // Wait to allow puter.ai.chat() to complete and send webhook
    await page.waitForTimeout(10000);

    console.log("✅ AI page loaded and executed.");
  } catch (err) {
    console.error("❌ Error in Playwright:", err.message);
  } finally {
    await browser.close();
  }
})();
