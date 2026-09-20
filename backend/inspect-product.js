const { chromium } = require("playwright");

(async () => {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    try {
        console.log("Opening product page...");

        await page.goto("https://demo.inelabteamdev.com/product/303", {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        const priceBlock = page.locator(".price-block");

        await priceBlock.waitFor({
            state: "visible",
            timeout: 20000
        });

        console.log("Price block detected.");

        const revealButton = page.getByRole("button", {
            name: /reveal price/i
        });

        console.log(
            "Button enabled BEFORE hover:",
            await revealButton.isEnabled()
        );

        await priceBlock.hover();

        console.log("Hovered over price block.");

        await page.waitForFunction(() => {
            const button = document.querySelector(
                'button[aria-label="Reveal price"]'
            );

            return button && !button.disabled;
        }, {
            timeout: 10000
        });

        console.log(
            "Button enabled AFTER hover:",
            await revealButton.isEnabled()
        );

        console.log("\nBEFORE CLICK:");
        console.log(
            await priceBlock.evaluate(
                element => element.outerHTML
            )
        );

        console.log("\nClicking Reveal Price...");

        await revealButton.click();

        console.log("Click completed.");

        // Wait a few seconds for asynchronous changes.
        await page.waitForTimeout(5000);

        console.log("\n================================");
        console.log("AFTER CLICK - PRICE BLOCK");
        console.log("================================");

        console.log(
            await priceBlock.evaluate(
                element => element.outerHTML
            )
        );

        console.log("\n================================");
        console.log("AFTER CLICK - BODY TEXT");
        console.log("================================");

        console.log(
            (await page.locator("body").innerText()).slice(0, 2500)
        );

        console.log("\n================================");
        console.log("PRICE-RELATED ELEMENTS");
        console.log("================================");

        const priceElements = await page.locator(
            '[class*="price"], [data-testid*="price"], [aria-label*="price" i]'
        ).evaluateAll(elements =>
            elements.map(element => ({
                tag: element.tagName,
                className: element.className,
                text: element.innerText,
                html: element.outerHTML
            }))
        );

        console.dir(priceElements, {
            depth: null
        });

        console.log("\nKeeping browser open for 10 seconds...");

        await page.waitForTimeout(10000);

    } catch (error) {
        console.error("\nERROR:");
        console.error(error.message);
    }

    await browser.close();
})();