const { chromium } = require("playwright");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

function extractPriceFromText(text) {
    if (!text) {
        return null;
    }

    const cleanedText = text
        .replace(/[\u200B-\u200D\uFEFF]/g, "");

    const match = cleanedText.match(
        /₹\s*([\d,]+(?:\.\d+)?)/
    );

    if (!match) {
        return null;
    }

    return cleanPrice(match[1]);
}

function extractStockFromText(text) {
    if (!text) {
        return null;
    }

    const cleanedText = text
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (/OUT OF STOCK/i.test(cleanedText)) {
        return "OUT OF STOCK";
    }

    const inStockMatch = cleanedText.match(
        /IN STOCK\s*[·•-]?\s*\d+\s*LEFT/i
    );

    if (inStockMatch) {
        return inStockMatch[0].trim();
    }

    return null;
}

async function scrapeProduct(productUrl) {
    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false",
        args: [
            "--ignore-certificate-errors",
            "--no-sandbox",
            "--disable-setuid-sandbox"
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

        const revealButton = page.getByRole("button", {
            name: /reveal price/i
        }).first();

        if (await revealButton.count() === 0) {
            throw new Error(
                "Reveal Price button was not found."
            );
        }

        console.log(
            "Button enabled BEFORE hover:",
            !(await revealButton.isDisabled())
        );

        console.log("Hovering over price block...");

        await priceBlock.hover({
            force: true,
            position: {
                x: 50,
                y: 50
            },
            timeout: 5000
        });

        console.log("Hover completed.");

        await sleep(500);

        let buttonEnabled =
            !(await revealButton.isDisabled());

        console.log(
            "Button enabled AFTER hover:",
            buttonEnabled
        );

        /*
         * Second interaction attempt.
         * This is intentionally short so a failing product
         * does not block the complete cron job.
         */

        if (!buttonEnabled) {
            console.log(
                "Trying direct mouse movement..."
            );

            const box =
                await priceBlock.boundingBox();

            if (box) {
                await page.mouse.move(
                    box.x + box.width / 2,
                    box.y + box.height / 2,
                    {
                        steps: 5
                    }
                );

                await sleep(500);
            }

            buttonEnabled =
                !(await revealButton.isDisabled());

            console.log(
                "Button enabled AFTER mouse movement:",
                buttonEnabled
            );
        }

        /*
         * If the store did not enable the button,
         * fail this attempt immediately.
         *
         * The retry mechanism will create the retry logs.
         */

        if (!buttonEnabled) {
            throw new Error(
                "Reveal Price button did not become enabled after hover interaction."
            );
        }

        console.log("Clicking Reveal Price...");

        await revealButton.click({
            timeout: 5000
        });

        console.log("Reveal Price clicked.");

        console.log(
            "Waiting for price and stock..."
        );

        const maxWait = 30000;
        const startTime = Date.now();

        let lastText = "";

        while (
            Date.now() - startTime < maxWait
        ) {
            const state =
                await page.evaluate(() => {
                    const block =
                        document.querySelector(
                            ".price-block"
                        );

                    return {
                        text:
                            block?.innerText?.trim() ||
                            ""
                    };
                });

            const price =
                extractPriceFromText(
                    state.text
                );

            const stock =
                extractStockFromText(
                    state.text
                );

            /*
             * IMPORTANT:
             * Return immediately when BOTH values are valid.
             * Do not wait for the store's later retries.
             */

            if (price && stock) {
                console.log(
                    "\n=============================="
                );

                console.log(
                    "VALID PRICE DATA FOUND"
                );

                console.log(
                    "=============================="
                );

                console.log(
                    "Price:",
                    price
                );

                console.log(
                    "Stock:",
                    stock
                );

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

                lastText =
                    state.text;
            }

            await sleep(250);
        }

        throw new Error(
            "Timed out waiting for valid price and stock data."
        );

    } catch (error) {

        console.error(
            "\n=============================="
        );

        console.error(
            "SCRAPING FAILED"
        );

        console.error(
            "=============================="
        );

        console.error(
            error.message
        );

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
        console.log(
            "\n================================="
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
            await scrapeProduct(
                productUrl
            );

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

        if (
            attempt < maxAttempts
        ) {
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