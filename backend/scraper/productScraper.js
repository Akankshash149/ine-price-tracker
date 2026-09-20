const { chromium } = require("playwright");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanPrice(rawPrice) {
    if (!rawPrice) return null;

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

function extractPriceFromText(text) {
    if (!text) return null;

    const match = text
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .match(/₹\s*([\d,]+(?:\.\d+)?)/);

    if (!match) return null;

    return cleanPrice(match[1]);
}

function extractStockFromText(text) {
    if (!text) return null;

    const cleaned = text
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (/OUT OF STOCK/i.test(cleaned)) {
        return "OUT OF STOCK";
    }

    const match = cleaned.match(
        /IN STOCK\s*[·•-]?\s*\d+\s*LEFT/i
    );

    if (match) {
        return match[0].trim();
    }

    return null;
}

async function scrapeProduct(productUrl) {
    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false",
        args: [
            "--ignore-certificate-errors",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    });

    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: {
            width: 1280,
            height: 900
        }
    });

    const page = await context.newPage();

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

        const buttonSelector =
            'button[aria-label="Reveal price"]';

        if (
            await page.locator(buttonSelector).count() === 0
        ) {
            throw new Error(
                "Reveal Price button was not found."
            );
        }

        /*
         * First put the mouse somewhere clearly outside
         * the price area.
         */

        console.log("Moving mouse outside price area...");

        await page.mouse.move(
            50,
            50,
            {
                steps: 10
            }
        );

        await sleep(500);

        /*
         * Get the real price block coordinates.
         */

        const priceBox =
            await priceBlock.boundingBox();

        if (!priceBox) {
            throw new Error(
                "Could not determine price block position."
            );
        }

        console.log("Price block position:", {
            x: Math.round(priceBox.x),
            y: Math.round(priceBox.y),
            width: Math.round(priceBox.width),
            height: Math.round(priceBox.height)
        });

        /*
         * Move the mouse gradually into the price area.
         *
         * This is different from locator.hover().
         * The store's JavaScript receives actual mouse
         * movement events.
         */

        const targetX =
            priceBox.x + priceBox.width / 2;

        const targetY =
            priceBox.y + priceBox.height / 2;

        console.log(
            "Performing real mouse movement over price..."
        );

        await page.mouse.move(
            targetX,
            targetY,
            {
                steps: 30
            }
        );

        await sleep(1500);

        /*
         * Move around slightly inside the price area.
         * This helps trigger mouseenter/mousemove based
         * interactions used by the mock store.
         */

        await page.mouse.move(
            targetX - 20,
            targetY - 10,
            {
                steps: 10
            }
        );

        await sleep(300);

        await page.mouse.move(
            targetX + 20,
            targetY + 10,
            {
                steps: 10
            }
        );

        await sleep(1000);

        /*
         * Check button state.
         */

        const buttonState =
            await page.evaluate(selector => {
                const button =
                    document.querySelector(selector);

                if (!button) {
                    return {
                        exists: false,
                        disabled: null
                    };
                }

                return {
                    exists: true,
                    disabled: button.disabled,
                    text: button.innerText
                };
            }, buttonSelector);

        console.log(
            "Button state after real mouse movement:",
            buttonState
        );

        /*
         * Now click normally.
         *
         * We do NOT remove the disabled attribute.
         * We want the store's own JavaScript to decide
         * when the button is ready.
         */

        if (buttonState.disabled) {
            console.log(
                "Button still disabled. Trying one more real hover..."
            );

            await page.mouse.move(
                priceBox.x + 10,
                priceBox.y + 10,
                {
                    steps: 15
                }
            );

            await sleep(1000);
        }

        const finalState =
            await page.evaluate(selector => {
                const button =
                    document.querySelector(selector);

                if (!button) {
                    return {
                        exists: false,
                        disabled: null
                    };
                }

                return {
                    exists: true,
                    disabled: button.disabled
                };
            }, buttonSelector);

        console.log(
            "Final button state:",
            finalState
        );

        /*
         * If the button is enabled, perform a real Playwright
         * click.
         */

        if (!finalState.disabled) {
            console.log("Clicking Reveal Price...");

            await page.locator(buttonSelector).click({
                timeout: 5000
            });

            console.log("Reveal Price clicked.");
        } else {
            /*
             * Do not immediately fail.
             *
             * The store may reveal the price automatically
             * after the hover challenge completes.
             */

            console.log(
                "Button remains disabled; waiting for price data..."
            );
        }

        /*
         * Wait for valid price + stock.
         *
         * IMPORTANT:
         * Return immediately after valid data appears.
         * Do not wait for the store's later 429/500 retries.
         */

        const maxWait = 30000;
        const startTime = Date.now();

        let lastText = "";

        while (Date.now() - startTime < maxWait) {
            const state = await page.evaluate(() => {
                const block =
                    document.querySelector(".price-block");

                return {
                    text:
                        block?.innerText?.trim() || ""
                };
            });

            const price =
                extractPriceFromText(state.text);

            const stock =
                extractStockFromText(state.text);

            if (price && stock) {
                console.log("");
                console.log("==============================");
                console.log("VALID PRICE DATA FOUND");
                console.log("==============================");
                console.log("Price:", price);
                console.log("Stock:", stock);
                console.log(
                    "Returning successful scrape immediately."
                );

                return {
                    success: true,
                    price,
                    stock,
                    error: null,
                    scrapedAt:
                        new Date().toISOString()
                };
            }

            if (
                state.text &&
                state.text !== lastText
            ) {
                console.log(
                    "Price status:",
                    state.text.replace(
                        /\n+/g,
                        " | "
                    )
                );

                lastText = state.text;
            }

            await sleep(250);
        }

        throw new Error(
            "Timed out waiting for valid price and stock data."
        );

    } catch (error) {
        console.error("");
        console.error("==============================");
        console.error("SCRAPING FAILED");
        console.error("==============================");
        console.error(error.message);

        return {
            success: false,
            price: null,
            stock: null,
            error: error.message,
            scrapedAt:
                new Date().toISOString()
        };

    } finally {
        await context.close();
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
        console.log("");
        console.log(
            "================================="
        );
        console.log(
            `SCRAPE ATTEMPT ${attempt}/${maxAttempts}`
        );
        console.log(
            "================================="
        );

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
                "Retrying after 3 seconds..."
            );

            await sleep(3000);
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