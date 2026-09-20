const { chromium } = require("playwright");

async function debugScraper() {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

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
            "Button enabled before hover:",
            await revealButton.isEnabled()
        );

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

        console.log("Button enabled after hover.");

        await revealButton.click();

        console.log("Reveal Price clicked.");

        await page.waitForTimeout(5000);

        console.log("\n==============================");
        console.log("AFTER CLICK DEBUG");
        console.log("==============================");

        console.log(
            "URL:",
            page.url()
        );

        console.log(
            "Price block count:",
            await page.locator(".price-block").count()
        );

        console.log(
            "Success block count:",
            await page.locator(".price-block.price-success").count()
        );

        console.log(
            "pv-a7 count:",
            await page.locator(".pv-a7").count()
        );

        console.log(
            "stock-badge count:",
            await page.locator(".stock-badge").count()
        );

        console.log("\n==============================");
        console.log("PRICE BLOCK TEXT");
        console.log("==============================");

        console.log(
            await page.locator(".price-block").innerText()
        );

        console.log("\n==============================");
        console.log("PRICE BLOCK HTML");
        console.log("==============================");

        console.log(
            await page.locator(".price-block").innerHTML()
        );

        console.log("\n==============================");
        console.log("ALL PRICE-RELATED ELEMENTS");
        console.log("==============================");

        const elements = await page.locator(
            ".price-block *"
        ).evaluateAll(nodes =>
            nodes.map(node => ({
                tag: node.tagName,
                className: node.className,
                text: node.innerText || "",
                ariaLabel: node.getAttribute("aria-label"),
                title: node.getAttribute("title"),
                dataPrice: node.getAttribute("data-price"),
                style: node.getAttribute("style")
            }))
        );

        console.log(
            JSON.stringify(elements, null, 2)
        );

        console.log("\n==============================");
        console.log("DEBUG FINISHED");
        console.log("==============================");

        await page.waitForTimeout(3000);

    } catch (error) {
        console.error("\n==============================");
        console.error("DEBUG FAILED");
        console.error("==============================");
        console.error(error.message);
    } finally {
        await browser.close();
    }
}

debugScraper();