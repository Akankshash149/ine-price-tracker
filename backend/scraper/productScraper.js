const { chromium } = require("playwright");


function cleanPrice(rawPrice) {
    if (!rawPrice) {
        return null;
    }

    const cleaned = rawPrice
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[^\d.,]/g, "")
        .replace(/,/g, "");

    const price = Number(cleaned);

    if (!Number.isFinite(price) || price <= 0) {
        return null;
    }

    return price;
}


async function scrapeProduct(productUrl) {

    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false"
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

        console.log("Waiting for final price result...");


        /*
         * The store can internally retry several times.
         *
         * We continuously inspect the DOM, but we use ONE
         * page.evaluate() call to read the complete current
         * state atomically.
         *
         * As soon as a valid price + stock is found,
         * we immediately return it.
         */

        const maxWait = 75000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {

            const state = await page.evaluate(() => {

                const block = document.querySelector(
                    ".price-block"
                );

                if (!block) {
                    return {
                        type: "waiting",
                        text: ""
                    };
                }

                const successBlock = block.classList.contains(
                    "price-success"
                );

                /*
                 * Read all possible price values.
                 *
                 * .pv-a7 is the visible selling price in the
                 * current successful DOM.
                 */

                const priceElement =
                    block.querySelector(".pv-a7");

                const stockElement =
                    block.querySelector(".stock-badge");

                const price =
                    priceElement?.textContent?.trim() || null;

                const stock =
                    stockElement?.textContent?.trim() || null;

                const text =
                    block.innerText?.trim() || "";

                const status =
                    block.querySelector(
                        ".price-status"
                    )?.textContent?.trim() || "";

                const substatus =
                    block.querySelector(
                        ".price-substatus"
                    )?.textContent?.trim() || "";

                if (
                    successBlock &&
                    price &&
                    stock
                ) {
                    return {
                        type: "success",
                        price,
                        stock,
                        text
                    };
                }

                if (
                    text.toLowerCase().includes(
                        "couldn’t load"
                    ) ||
                    text.toLowerCase().includes(
                        "couldn't load"
                    )
                ) {
                    return {
                        type: "failed",
                        text
                    };
                }

                return {
                    type: "waiting",
                    status,
                    substatus,
                    text
                };
            });


            /*
             * SUCCESS
             *
             * Immediately return. Do NOT perform another
             * wait or DOM lookup.
             */

            if (state.type === "success") {

                console.log("\n==============================");
                console.log("SCRAPED PRODUCT DATA");
                console.log("==============================");
                console.log("URL:", productUrl);
                console.log("Raw Price:", state.price);
                console.log("Stock:", state.stock);
                console.log("==============================");

                const price = cleanPrice(state.price);

                if (!price) {
                    throw new Error(
                        "Invalid price received: " +
                        state.price
                    );
                }

                if (!state.stock.trim()) {
                    throw new Error(
                        "Stock information was empty."
                    );
                }

                return {
                    success: true,
                    price: price,
                    rawPrice: state.price,
                    stock: state.stock.trim(),
                    error: null,
                    scrapedAt: new Date().toISOString()
                };
            }


            /*
             * FINAL FAILURE
             */

            if (state.type === "failed") {

                throw new Error(
                    "Store failed to load price: " +
                    state.text.replace(/\n+/g, " ")
                );
            }


            /*
             * Show useful status only when there is
             * meaningful information.
             */

            if (
                state.status ||
                state.substatus
            ) {

                const statusText = [
                    state.status,
                    state.substatus
                ]
                    .filter(Boolean)
                    .join(" | ");

                console.log(
                    "Current price status:",
                    statusText
                );
            }


            await page.waitForTimeout(500);
        }


        throw new Error(
            "Timed out waiting for the store to return final price data."
        );


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



async function scrapeWithRetry(
    productUrl,
    maxAttempts = 3
) {

    const attempts = [];


    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        console.log("\n=================================");
        console.log(
            `SCRAPE ATTEMPT ${attempt}/${maxAttempts}`
        );
        console.log("=================================");

        const startedAt =
            new Date().toISOString();


        const result =
            await scrapeProduct(productUrl);


        const finishedAt =
            new Date().toISOString();


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


        attempts.push({
            attempt,
            status:
                attempt < maxAttempts
                    ? "retried"
                    : "failed",
            startedAt,
            finishedAt,
            error: result.error
        });


        if (attempt < maxAttempts) {

            console.log(
                "Retrying after 2 seconds..."
            );

            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
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