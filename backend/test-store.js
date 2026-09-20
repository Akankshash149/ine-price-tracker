const { chromium } = require("playwright");

(async () => {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    console.log("Opening INE mock store...");

    try {
        await page.goto("https://demo.inelabteamdev.com/", {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("Page loaded successfully!");
        console.log("Title:", await page.title());
        console.log("URL:", page.url());

        await page.waitForTimeout(10000);

    } catch (error) {
        console.error("Failed to open store:");
        console.error(error.message);
    }

    await browser.close();
})();