const { chromium } = require("playwright");

const STORE_URL = "https://demo.inelabteamdev.com/";
const CATALOG_API =
    "https://demo.inelabteamdev.com/api/catalog";

function sleep(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

async function getCatalogPage(
    page,
    pageNumber,
    maxAttempts = 5
) {
    const url =
        `${CATALOG_API}?page=${pageNumber}&pageSize=20`;

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {
        try {
            console.log(
                `Fetching catalog page ${pageNumber} (attempt ${attempt}/${maxAttempts})...`
            );

            const response =
                await page.request.get(url, {
                    timeout: 30000
                });

            if (response.ok()) {
                const data =
                    await response.json();

                if (
                    !data ||
                    !Array.isArray(data.items)
                ) {
                    throw new Error(
                        `Invalid catalog response for page ${pageNumber}`
                    );
                }

                return data;
            }

            const status =
                response.status();

            if (status === 429) {
                let retryAfter = 2;

                try {
                    const body =
                        await response.json();

                    if (
                        body &&
                        body.retryAfter
                    ) {
                        retryAfter =
                            Number(body.retryAfter);
                    }
                } catch {
                    // Ignore invalid JSON
                }

                const waitTime =
                    Math.max(
                        retryAfter * 1000,
                        2000
                    ) +
                    (attempt * 1000);

                console.log(
                    `Catalog API rate-limited page ${pageNumber}. Waiting ${waitTime} ms before retry...`
                );

                await sleep(waitTime);

                continue;
            }

            throw new Error(
                `Catalog API returned ${status} for page ${pageNumber}`
            );

        } catch (error) {
            if (
                attempt === maxAttempts
            ) {
                throw error;
            }

            const waitTime =
                2000 + attempt * 1000;

            console.log(
                `Catalog request failed for page ${pageNumber}: ${error.message}`
            );

            console.log(
                `Waiting ${waitTime} ms before retry...`
            );

            await sleep(waitTime);
        }
    }

    throw new Error(
        `Unable to fetch catalog page ${pageNumber}`
    );
}

async function discoverStoreProducts(
    search = ""
) {
    const browser =
        await chromium.launch({
            headless: false
        });

    const page =
        await browser.newPage();

    try {
        console.log(
            "Opening store..."
        );

        await page.goto(
            STORE_URL,
            {
                waitUntil:
                    "domcontentloaded",
                timeout: 30000
            }
        );

        await page.waitForTimeout(
            1000
        );

        console.log(
            "Store opened successfully."
        );

        const firstPage =
            await getCatalogPage(
                page,
                1
            );

        const totalProducts =
            firstPage.total;

        const totalPages =
            firstPage.pages;

        console.log(
            `Store contains ${totalProducts} products across ${totalPages} pages.`
        );

        const products = [];

        for (
            let pageNumber = 1;
            pageNumber <= totalPages;
            pageNumber++
        ) {
            let catalogPage;

            if (pageNumber === 1) {
                catalogPage =
                    firstPage;
            } else {
                /*
                 * Small delay between normal
                 * catalog requests.
                 *
                 * This prevents the mock store
                 * from rate-limiting us.
                 */
                await sleep(1200);

                catalogPage =
                    await getCatalogPage(
                        page,
                        pageNumber
                    );
            }

            for (
                const item of
                catalogPage.items
            ) {
                if (
                    !item ||
                    !item.id ||
                    !item.name
                ) {
                    continue;
                }

                products.push({
                    id: item.id,

                    product_name:
                        item.name,

                    brand:
                        item.brand ||
                        null,

                    category:
                        item.category ||
                        null,

                    sku:
                        item.sku ||
                        null,

                    product_url:
                        `${STORE_URL}product/${item.id}`
                });
            }

            console.log(
                `Page ${pageNumber}/${totalPages} loaded. Total collected: ${products.length}`
            );
        }

        const normalizedSearch =
            search
                .trim()
                .toLowerCase();

        let filteredProducts =
            products;

        if (normalizedSearch) {
            filteredProducts =
                products.filter(
                    product => {
                        const searchableText = [
                            product.product_name,
                            product.brand,
                            product.category,
                            product.sku
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();

                        return searchableText.includes(
                            normalizedSearch
                        );
                    }
                );
        }

        console.log(
            "\n================================="
        );

        console.log(
            `Total products discovered: ${products.length}`
        );

        console.log(
            `Products matching "${search}": ${filteredProducts.length}`
        );

        console.log(
            "================================="
        );

        return {
            success: true,

            products:
                filteredProducts,

            totalProducts,

            totalPages
        };

    } catch (error) {
        console.error(
            "\nStore discovery failed:"
        );

        console.error(
            error.message
        );

        return {
            success: false,

            products: [],

            totalProducts: 0,

            totalPages: 0,

            error:
                error.message
        };

    } finally {
        await browser.close();
    }
}

module.exports = {
    discoverStoreProducts
};