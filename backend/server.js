const express = require("express");
const cors = require("cors");
require("dotenv").config();

const supabase = require("./supabase");

const {
    scrapeWithRetry
} = require("./scraper/productScraper");

const {
    discoverStoreProducts
} = require("./scraper/storeDiscovery");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;


/*
========================================
HELPER: TIMEOUT
========================================
*/

function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
        promise,

        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(message));
            }, timeoutMs);
        })
    ]);
}


/*
========================================
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {
    res.json({
        message: "INE Price Tracker API is running"
    });
});


/*
========================================
GET TRACKED PRODUCTS
========================================
*/

app.get(
    "/api/products",
    async (req, res) => {
        try {
            console.log("GET /api/products started");

            console.log(
                "Querying Supabase products table..."
            );

            const {
                data,
                error
            } = await withTimeout(
                supabase
                    .from("products")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    ),

                10000,

                "Supabase products query timed out."
            );

            console.log(
                "Supabase products query completed."
            );

            if (error) {
                console.error(
                    "Supabase products error:",
                    error.message
                );

                return res
                    .status(500)
                    .json({
                        error: error.message
                    });
            }

            res.json(data);

        } catch (error) {

            console.error(
                "GET /api/products failed:",
                error.message
            );

            res
                .status(500)
                .json({
                    error: error.message
                });
        }
    }
);


/*
========================================
SEARCH PRODUCTS FROM INE STORE
========================================
*/

app.get(
    "/api/store/search",
    async (req, res) => {

        try {

            const search =
                String(
                    req.query.q || ""
                ).trim();

            if (!search) {
                return res.json({
                    success: true,
                    products: []
                });
            }

            console.log(
                `Store search requested: "${search}"`
            );

            const result =
                await discoverStoreProducts(
                    search
                );

            if (!result.success) {

                return res
                    .status(502)
                    .json({
                        success: false,
                        products: [],
                        error:
                            result.error
                    });
            }

            const uniqueProducts =
                Array.from(
                    new Map(
                        result.products.map(
                            product => [
                                product.id,
                                product
                            ]
                        )
                    ).values()
                );

            res.json({
                success: true,
                products:
                    uniqueProducts,
                total:
                    uniqueProducts.length
            });

        } catch (error) {

            console.error(
                "Store search failed:",
                error.message
            );

            res
                .status(500)
                .json({
                    success: false,
                    products: [],
                    error:
                        error.message
                });
        }
    }
);


/*
========================================
TRACK A STORE PRODUCT
========================================
*/

app.post(
    "/api/products/track",
    async (req, res) => {

        try {

            const {
                id,
                product_name,
                brand,
                category,
                sku,
                product_url
            } = req.body;

            if (
                !id ||
                !product_name ||
                !product_url
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "id, product_name and product_url are required"
                    });
            }

            console.log(
                `Checking whether product is already tracked: ${product_name}`
            );

            const {
                data: existingProduct,
                error:
                    existingError
            } = await withTimeout(
                supabase
                    .from("products")
                    .select("*")
                    .eq(
                        "product_url",
                        product_url
                    )
                    .maybeSingle(),

                10000,

                "Supabase product lookup timed out."
            );

            if (existingError) {

                return res
                    .status(500)
                    .json({
                        error:
                            existingError.message
                    });
            }

            if (existingProduct) {

                return res.json({
                    success: true,
                    alreadyTracked: true,
                    product:
                        existingProduct
                });
            }

            const {
                data,
                error
            } = await withTimeout(
                supabase
                    .from("products")
                    .insert({
                        product_name,
                        product_url,
                        sku:
                            sku || null,
                        category:
                            category || null
                    })
                    .select()
                    .single(),

                10000,

                "Supabase product insert timed out."
            );

            if (error) {

                return res
                    .status(500)
                    .json({
                        error:
                            error.message
                    });
            }

            console.log(
                `Product tracked: ${product_name}`
            );

            res.status(201).json({

                success: true,

                alreadyTracked:
                    false,

                product:
                    data
            });

        } catch (error) {

            console.error(
                "Track product failed:",
                error.message
            );

            res
                .status(500)
                .json({
                    error:
                        error.message
                });
        }
    }
);


/*
========================================
SCRAPE ONE TRACKED PRODUCT
========================================
*/

app.post(
    "/api/products/:id/scrape",
    async (req, res) => {

        console.log(
            `\nSCRAPE REQUEST RECEIVED FOR PRODUCT ID: ${req.params.id}`
        );

        try {

            const productId =
                req.params.id;

            console.log(
                "Step 1: Querying Supabase for product..."
            );

            const {
                data: product,
                error:
                    productError
            } = await withTimeout(

                supabase
                    .from("products")
                    .select("*")
                    .eq(
                        "id",
                        productId
                    )
                    .single(),

                10000,

                "Supabase product lookup timed out."
            );

            console.log(
                "Step 2: Supabase product query completed."
            );

            if (
                productError ||
                !product
            ) {

                console.error(
                    "Product lookup failed:",
                    productError?.message ||
                    "Product not found"
                );

                return res
                    .status(404)
                    .json({
                        error:
                            "Product not found"
                    });
            }

            console.log(
                `Step 3: Product found: ${product.product_name}`
            );

            console.log(
                `Product URL: ${product.product_url}`
            );

            console.log(
                "Step 4: Starting scraper..."
            );

            const result =
                await scrapeWithRetry(
                    product.product_url
                );

            console.log(
                "Step 5: Scraper finished."
            );

            /*
             * Save scrape attempts.
             */

            if (
                result.attempts &&
                result.attempts.length
            ) {

                console.log(
                    "Step 6: Saving scrape logs..."
                );

                const logs =
                    result.attempts.map(
                        attempt => ({

                            product_id:
                                product.id,

                            attempt_number:
                                attempt.attempt,

                            status:
                                attempt.status,

                            error_message:
                                attempt.error,

                            started_at:
                                attempt.startedAt,

                            finished_at:
                                attempt.finishedAt
                        })
                    );

                const {
                    error:
                        logsError
                } = await withTimeout(

                    supabase
                        .from(
                            "scrape_logs"
                        )
                        .insert(logs),

                    10000,

                    "Supabase scrape logs insert timed out."
                );

                if (logsError) {

                    console.error(
                        "Failed to save scrape logs:",
                        logsError.message
                    );
                } else {

                    console.log(
                        "Scrape logs saved."
                    );
                }
            }


            /*
             * Save history only if scrape succeeds.
             */

            if (result.success) {

                console.log(
                    "Step 7: Scrape successful."
                );

                console.log(
                    "Saving price history..."
                );

                const {
                    data:
                        historyData,
                    error:
                        historyError
                } = await withTimeout(

                    supabase
                        .from(
                            "price_history"
                        )
                        .insert({

                            product_id:
                                product.id,

                            price:
                                result.price,

                            stock:
                                result.stock

                        })
                        .select()
                        .single(),

                    10000,

                    "Supabase price history insert timed out."
                );

                if (historyError) {

                    console.error(
                        "Price history error:",
                        historyError.message
                    );

                    return res
                        .status(500)
                        .json({
                            error:
                                historyError.message
                        });
                }

                console.log(
                    "Price history saved."
                );

                console.log(
                    "Step 8: Sending successful response."
                );

                return res.json({

                    success: true,

                    product,

                    price:
                        result.price,

                    stock:
                        result.stock,

                    history:
                        historyData,

                    attempts:
                        result.attempts
                });
            }


            /*
             * Scrape failed.
             */

            console.log(
                "Scrape failed after retries."
            );

            return res
                .status(502)
                .json({

                    success: false,

                    product,

                    price: null,

                    stock: null,

                    attempts:
                        result.attempts,

                    error:
                        "Unable to retrieve current price after retries."
                });

        } catch (error) {

            console.error(
                "\nSCRAPE ENDPOINT FAILED:"
            );

            console.error(
                error.message
            );

            return res
                .status(500)
                .json({
                    success: false,
                    error:
                        error.message
                });
        }
    }
);


/*
========================================
CRON AUTHENTICATION
========================================
*/

function verifyCronSecret(
    req,
    res,
    next
) {

    const cronSecret =
        process.env.CRON_SECRET;

    if (!cronSecret) {

        console.error(
            "CRON_SECRET is not configured."
        );

        return res
            .status(500)
            .json({
                success: false,
                error:
                    "CRON_SECRET is not configured on the server."
            });
    }

    const providedSecret =
        req.get("x-cron-secret");

    if (
        !providedSecret ||
        providedSecret !== cronSecret
    ) {

        return res
            .status(401)
            .json({
                success: false,
                error:
                    "Unauthorized cron request."
            });
    }

    next();
}


/*
========================================
SCRAPE ALL TRACKED PRODUCTS
========================================
*/

app.post(
    "/api/cron/scrape-all",
    verifyCronSecret,
    async (req, res) => {

        console.log(
            "\nCRON SCRAPE REQUEST RECEIVED"
        );

        try {

            console.log(
                "Loading tracked products..."
            );

            const {
                data: products,
                error
            } = await withTimeout(

                supabase
                    .from("products")
                    .select("*"),

                10000,

                "Supabase tracked products query timed out."
            );

            if (error) {

                return res
                    .status(500)
                    .json({
                        error:
                            error.message
                    });
            }

            console.log(
                `Found ${products.length} tracked products.`
            );

            const results = [];

            for (
                const product of
                products
            ) {

                console.log(
                    `\nCron scraping: ${product.product_name}`
                );

                const result =
                    await scrapeWithRetry(
                        product.product_url
                    );

                if (
                    result.attempts &&
                    result.attempts.length
                ) {

                    const logs =
                        result.attempts.map(
                            attempt => ({

                                product_id:
                                    product.id,

                                attempt_number:
                                    attempt.attempt,

                                status:
                                    attempt.status,

                                error_message:
                                    attempt.error,

                                started_at:
                                    attempt.startedAt,

                                finished_at:
                                    attempt.finishedAt
                            })
                        );

                    await withTimeout(

                        supabase
                            .from(
                                "scrape_logs"
                            )
                            .insert(logs),

                        10000,

                        "Supabase cron scrape logs insert timed out."
                    );
                }

                if (result.success) {

                    await withTimeout(

                        supabase
                            .from(
                                "price_history"
                            )
                            .insert({

                                product_id:
                                    product.id,

                                price:
                                    result.price,

                                stock:
                                    result.stock
                            }),

                        10000,

                        "Supabase cron price history insert timed out."
                    );
                }

                results.push({

                    product_id:
                        product.id,

                    product_name:
                        product.product_name,

                    success:
                        result.success,

                    price:
                        result.success
                            ? result.price
                            : null,

                    stock:
                        result.success
                            ? result.stock
                            : null
                });
            }

            console.log(
                "CRON SCRAPE COMPLETED"
            );

            res.json({

                success: true,

                results
            });

        } catch (error) {

            console.error(
                "Cron scrape failed:",
                error.message
            );

            res
                .status(500)
                .json({
                    success: false,
                    error:
                        error.message
                });
        }
    }
);


/*
========================================
PRICE HISTORY
========================================
*/

app.get(
    "/api/products/:id/history",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await withTimeout(

                supabase
                    .from(
                        "price_history"
                    )
                    .select("*")
                    .eq(
                        "product_id",
                        req.params.id
                    )
                    .order(
                        "scraped_at",
                        {
                            ascending: true
                        }
                    ),

                10000,

                "Supabase price history query timed out."
            );

            if (error) {

                return res
                    .status(500)
                    .json({
                        error:
                            error.message
                    });
            }

            res.json(data);

        } catch (error) {

            res
                .status(500)
                .json({
                    error:
                        error.message
                });
        }
    }
);


/*
========================================
SCRAPE LOGS
========================================
*/

app.get(
    "/api/products/:id/logs",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await withTimeout(

                supabase
                    .from(
                        "scrape_logs"
                    )
                    .select("*")
                    .eq(
                        "product_id",
                        req.params.id
                    )
                    .order(
                        "started_at",
                        {
                            ascending: false
                        }
                    ),

                10000,

                "Supabase scrape logs query timed out."
            );

            if (error) {

                return res
                    .status(500)
                    .json({
                        error:
                            error.message
                    });
            }

            res.json(data);

        } catch (error) {

            res
                .status(500)
                .json({
                    error:
                        error.message
                });
        }
    }
);


/*
========================================
START SERVER
========================================
*/

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );
    }
);