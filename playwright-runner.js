const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("🧠 Visiting your AI page...");
    await page.goto('https://your-project.up.railway.app', { waitUntil: 'load', timeout: 60000 });

    // Wait for AI + webhook to complete
    await page.waitForTimeout(10000); // Wait 10 seconds

    console.log("✅ AI page loaded and executed.");
  } catch (err) {
    console.error("❌ Failed to run:", err.message);
  } finally {
    await browser.close();
  }
})();
