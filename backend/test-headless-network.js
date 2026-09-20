const { chromium } = require("playwright");

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-gpu"
        ]
    });

    const context = await browser.newContext({
        viewport: {
            width: 1366,
            height: 768
        },
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/153.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();

    page.on("request", request => {
        const url = request.url();

        if (
            url.includes("/api/challenge") ||
            url.includes("/api/session") ||
            url.includes("/api/products/303/price")
        ) {
            console.log("\nREQUEST:");
            console.log(request.method(), url);
        }
    });

    page.on("response", async response => {
        const url = response.url();

        if (
            url.includes("/api/challenge") ||
            url.includes("/api/session") ||
            url.includes("/api/products/303/price")
        ) {
            console.log("\nRESPONSE:");
            console.log(response.status(), url);

            try {
                const text = await response.text();
                console.log("BODY:");
                console.log(text.substring(0, 2000));
            } catch (error) {
                console.log("Could not read response body.");
            }
        }
    });

    try {
        console.log("Opening product page...");

        await page.goto(
            "https://demo.inelabteamdev.com/product/303",
            {
                waitUntil: "domcontentloaded",
                timeout: 30000
            }
        );

        console.log("Page loaded.");

        await page.waitForTimeout(3000);

        const priceBlock = page.locator(".price-block");

        await priceBlock.waitFor({
            state: "visible",
            timeout: 30000
        });

        console.log("Price block detected.");

        const button = page.getByRole("button", {
            name: /reveal price/i
        });

        console.log(
            "Button enabled before hover:",
            await button.isEnabled()
        );

        await priceBlock.hover({
            force: true
        });

        console.log("Hover completed.");

        await page.waitForTimeout(5000);

        console.log(
            "Button enabled after hover:",
            await button.isEnabled()
        );

        console.log("\nWaiting 5 more seconds...");

        await page.waitForTimeout(5000);

        console.log(
            "Button enabled after waiting:",
            await button.isEnabled()
        );

    } catch (error) {
        console.error("\nERROR:");
        console.error(error.message);
    } finally {
        await browser.close();
    }
}

main();