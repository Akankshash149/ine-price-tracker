const { chromium } = require("playwright");

async function scrapeProduct(productUrl) {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    try {
        console.log("Opening:", productUrl);

        await page.goto(productUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("Page loaded.");

        const priceBlock = page.locator(".price-block");

        await priceBlock.waitFor({
            state: "visible",
            timeout: 30000
        });

        console.log("Price block detected.");

        const revealButton = page.getByRole("button", {
            name: /reveal price/i
        });

        console.log(
            "Button enabled BEFORE hover:",
            await revealButton.isEnabled()
        );

        console.log("Hovering over price block...");

        await priceBlock.hover();

        console.log("Hover completed.");

        await page.waitForFunction(
            () => {
                const button = document.querySelector(
                    'button[aria-label="Reveal price"]'
                );

                return button && !button.disabled;
            },
            {
                timeout: 30000
            }
        );

        console.log(
            "Button enabled AFTER hover:",
            await revealButton.isEnabled()
        );

        console.log("Clicking Reveal Price...");

        await revealButton.click();

        console.log("Reveal Price clicked.");

        await page.locator(
            ".price-block.price-success"
        ).waitFor({
            state: "visible",
            timeout: 30000
        });

        console.log("Price success state detected!");

        const price = await page.locator(
            ".price-block.price-success .pv-a7"
        ).innerText();

        const stock = await page.locator(
            ".price-block.price-success .stock-badge"
        ).innerText();

        if (!price || !price.trim()) {
            throw new Error("Price was empty.");
        }

        if (!stock || !stock.trim()) {
            throw new Error("Stock information was empty.");
        }

        console.log("\n==============================");
        console.log("SCRAPED PRODUCT DATA");
        console.log("==============================");
        console.log("URL:", productUrl);
        console.log("Price:", price);
        console.log("Stock:", stock);
        console.log("==============================");

        return {
            success: true,
            price: price.trim(),
            stock: stock.trim(),
            error: null,
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {

        console.error("\n==============================");
        console.error("SCRAPING FAILED");
        console.error("==============================");
        console.error(error.message);

        return {
            success: false,
            price: null,
            stock: null,
            error: error.message,
            scrapedAt: new Date().toISOString()
        };

    } finally {
        await browser.close();
    }
}


// Retry mechanism
async function scrapeWithRetry(productUrl, maxAttempts = 3) {

    const attempts = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        console.log("\n=================================");
        console.log(`SCRAPE ATTEMPT ${attempt}/${maxAttempts}`);
        console.log("=================================");

        const startedAt = new Date().toISOString();

        const result = await scrapeProduct(productUrl);

        const finishedAt = new Date().toISOString();

        if (result.success) {

            attempts.push({
                attempt,
                status: "success",
                startedAt,
                finishedAt,
                error: null
            });

            return {
                success: true,
                price: result.price,
                stock: result.stock,
                attempts
            };
        }

        // Failed attempt
        attempts.push({
            attempt,
            status: attempt < maxAttempts ? "retried" : "failed",
            startedAt,
            finishedAt,
            error: result.error
        });

        // Wait before next retry
        if (attempt < maxAttempts) {
            console.log("Retrying after 2 seconds...");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    return {
        success: false,
        price: null,
        stock: null,
        attempts
    };
}


module.exports = {
    scrapeProduct,
    scrapeWithRetry
};