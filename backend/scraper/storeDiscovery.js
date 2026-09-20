const { chromium } = require("playwright");


const STORE_URL =
    "https://demo.inelabteamdev.com";


function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}


/*
========================================
GET ONE CATALOG PAGE
========================================
*/

async function getCatalogPage(
    request,
    pageNumber,
    maxAttempts = 5
) {

    const url =
        `${STORE_URL}/api/catalog?page=${pageNumber}&pageSize=20`;


    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        try {

            console.log(
                `Catalog page ${pageNumber} - attempt ${attempt}/${maxAttempts}`
            );


            const response =
                await request.get(
                    url,
                    {
                        timeout: 30000
                    }
                );


            if (
                response.status() ===
                200
            ) {

                const data =
                    await response.json();


                if (
                    data &&
                    Array.isArray(
                        data.items
                    )
                ) {

                    return data;
                }


                throw new Error(
                    "Catalog response did not contain an items array."
                );
            }


            /*
             * Store can return 429.
             * Wait and retry.
             */

            if (
                response.status() ===
                429
            ) {

                let retryAfter =
                    null;


                try {

                    const errorData =
                        await response.json();

                    retryAfter =
                        Number(
                            errorData.retryAfter
                        );

                } catch {
                    /*
                     * Ignore JSON parsing failure.
                     */
                }


                const waitTime =
                    Number.isFinite(
                        retryAfter
                    ) &&
                    retryAfter > 0

                        ? retryAfter * 1000

                        : 2000 +
                          attempt * 1000;


                console.log(
                    `Catalog page ${pageNumber} returned 429. Waiting ${waitTime}ms before retry...`
                );


                await sleep(
                    waitTime
                );

                continue;
            }


            throw new Error(
                `Catalog request returned HTTP ${response.status()}`
            );

        } catch (error) {

            console.error(
                `Catalog page ${pageNumber} attempt ${attempt} failed:`,
                error.message
            );


            if (
                attempt >=
                maxAttempts
            ) {

                throw error;
            }


            const waitTime =
                2000 +
                attempt * 1000;


            console.log(
                `Retrying catalog page ${pageNumber} after ${waitTime}ms...`
            );


            await sleep(
                waitTime
            );
        }
    }


    throw new Error(
        `Unable to load catalog page ${pageNumber}`
    );
}


/*
========================================
DISCOVER STORE PRODUCTS
========================================
*/

async function discoverStoreProducts(
    search = ""
) {

    /*
     * IMPORTANT:
     *
     * ignoreHTTPSErrors allows Playwright
     * to connect when the store/network
     * presents a self-signed certificate.
     */

    const browser =
        await chromium.launch({
            headless:
                process.env.HEADLESS !==
                "false"
        });


    const context =
        await browser.newContext({
            ignoreHTTPSErrors: true
        });


    const request =
        await context.request;


    try {

        console.log(
            "Opening INE store catalog..."
        );


        /*
         * First request tells us how many
         * pages/products exist.
         */

        const firstPage =
            await getCatalogPage(
                request,
                1
            );


        const totalPages =
            Number(
                firstPage.pages || 1
            );


        const totalProducts =
            Number(
                firstPage.total || 0
            );


        console.log(
            `Store catalog: ${totalProducts} products across ${totalPages} pages`
        );


        const allProducts = [];


        /*
         * Add first page.
         */

        allProducts.push(
            ...firstPage.items
        );


        /*
         * Load remaining pages.
         */

        for (
            let pageNumber = 2;
            pageNumber <= totalPages;
            pageNumber++
        ) {

            try {

                const pageData =
                    await getCatalogPage(
                        request,
                        pageNumber
                    );


                allProducts.push(
                    ...pageData.items
                );


                /*
                 * Small delay so that we
                 * don't hammer the store.
                 */

                await sleep(
                    1200
                );

            } catch (error) {

                console.error(
                    `Failed to load catalog page ${pageNumber}:`,
                    error.message
                );


                /*
                 * Continue with the pages
                 * that were successfully loaded.
                 */

                continue;
            }
        }


        /*
         * Remove duplicate products.
         */

        const uniqueProducts =
            Array.from(
                new Map(
                    allProducts.map(
                        product => [
                            product.id,
                            product
                        ]
                    )
                ).values()
            );


        /*
         * Search locally.
         *
         * Search checks:
         * - product name
         * - brand
         * - category
         * - SKU
         */

        const normalizedSearch =
            String(
                search || ""
            )
                .trim()
                .toLowerCase();


        let filteredProducts =
            uniqueProducts;


        if (
            normalizedSearch
        ) {

            filteredProducts =
                uniqueProducts.filter(
                    product => {

                        const searchableText =
                            [
                                product.name,
                                product.brand,
                                product.category,
                                product.sku
                            ]
                                .filter(
                                    Boolean
                                )
                                .join(" ")
                                .toLowerCase();


                        return searchableText.includes(
                            normalizedSearch
                        );
                    }
                );
        }


        console.log(
            `Products matching "${search}": ${filteredProducts.length}`
        );


        return {

            success:
                true,

            products:
                filteredProducts,

            totalProducts:
                totalProducts,

            totalPages:
                totalPages
        };

    } catch (error) {

        console.error(
            "Store discovery failed:",
            error.message
        );


        return {

            success:
                false,

            products:
                [],

            totalProducts:
                0,

            totalPages:
                0,

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