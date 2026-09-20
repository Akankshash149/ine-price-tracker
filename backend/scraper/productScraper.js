const { chromium } = require("playwright");

function sleep(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
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
    const browser =
        await chromium.launch({
            headless:
                process.env.HEADLESS !== "false",
            args: [
                "--ignore-certificate-errors"
            ]
        });

    const context =
        await browser.newContext({
            ignoreHTTPSErrors: true
        });

    const page =
        await context.newPage();

    try {
        console.log(
            "Opening:",
            productUrl
        );

        await page.goto(
            productUrl,
            {
                waitUntil:
                    "domcontentloaded",
                timeout: 60000
            }
        );

        console.log(
            "Page loaded."
        );

        const priceBlock =
            page.locator(
                ".price-block"
            );

        await priceBlock.waitFor({
            state: "visible",
            timeout: 60000
        });

        console.log(
            "Price block detected."
        );

        const revealButton =
            page.getByRole(
                "button",
                {
                    name: /reveal price/i
                }
            );

        if (
            await revealButton.count() ===
            0
        ) {
            throw new Error(
                "Reveal Price button was not found."
            );
        }

        console.log(
            "Button count:",
            await revealButton.count()
        );

        console.log(
            "Button enabled BEFORE hover:",
            !(await revealButton.isDisabled())
        );

        console.log(
            "Hovering over price block..."
        );

        await priceBlock.hover();

        console.log(
            "Hover completed."
        );

        const buttonWaitStart =
            Date.now();

        let buttonEnabled =
            false;

        while (
            Date.now() -
                buttonWaitStart <
            60000
        ) {
            try {
                buttonEnabled =
                    !(await revealButton.isDisabled());

                if (
                    buttonEnabled
                ) {
                    break;
                }
            } catch {}

            await sleep(500);
        }

        console.log(
            "Button enabled AFTER hover:",
            buttonEnabled
        );

        if (
            !buttonEnabled
        ) {
            throw new Error(
                "Reveal Price button did not become enabled after hover."
            );
        }

        console.log(
            "Clicking Reveal Price..."
        );

        await revealButton.click();

        console.log(
            "Reveal Price clicked."
        );

        console.log(
            "Waiting for price and stock..."
        );

        const maxWait =
            30000;

        const startTime =
            Date.now();

        let lastText = "";

        while (
            Date.now() -
                startTime <
            maxWait
        ) {
            const state =
                await page.evaluate(
                    () => {
                        const block =
                            document.querySelector(
                                ".price-block"
                            );

                        if (!block) {
                            return {
                                text: ""
                            };
                        }

                        return {
                            text:
                                block.innerText
                                    ?.trim() ||
                                ""
                        };
                    }
                );

            const price =
                extractPriceFromText(
                    state.text
                );

            const stock =
                extractStockFromText(
                    state.text
                );

            if (
                price &&
                stock
            ) {
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
                    success:
                        true,
                    price,
                    stock,
                    error:
                        null,
                    scrapedAt:
                        new Date().toISOString()
                };
            }

            if (
                state.text &&
                state.text !==
                    lastText
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
            success:
                false,
            price:
                null,
            stock:
                null,
            error:
                error.message,
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

        if (
            result.success
        ) {
            attempts.push({
                attempt,
                status:
                    "success",
                startedAt,
                finishedAt,
                error:
                    null
            });

            return {
                success:
                    true,
                price:
                    result.price,
                stock:
                    result.stock,
                attempts
            };
        }

        attempts.push({
            attempt,
            status:
                attempt <
                maxAttempts
                    ? "retried"
                    : "failed",
            startedAt,
            finishedAt,
            error:
                result.error
        });

        if (
            attempt <
            maxAttempts
        ) {
            console.log(
                "Retrying after 3 seconds..."
            );

            await sleep(
                3000
            );
        }
    }

    return {
        success:
            false,
        price:
            null,
        stock:
            null,
        attempts
    };
}

module.exports = {
    scrapeProduct,
    scrapeWithRetry
};