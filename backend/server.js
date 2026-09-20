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

const PORT =
    process.env.PORT || 5000;


/*
========================================
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {
    res.json({
        message:
            "INE Price Tracker API is running"
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
            const {
                data,
                error
            } = await supabase
                .from("products")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
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
SEARCH PRODUCTS FROM INE STORE
========================================

Example:

GET /api/store/search?q=Vista
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


            /*
             * Remove duplicate products
             * using store product ID.
             */

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


            /*
             * Check if product already exists.
             */

            const {
                data: existingProduct,
                error:
                    existingError
            } = await supabase
                .from("products")
                .select("*")
                .eq(
                    "product_url",
                    product_url
                )
                .maybeSingle();


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

                    alreadyTracked:
                        true,

                    product:
                        existingProduct
                });
            }


            /*
             * Insert product into
             * tracked products table.
             */

            const {
                data,
                error
            } = await supabase
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
                .single();


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

        try {

            const productId =
                req.params.id;


            const {
                data: product,
                error:
                    productError
            } = await supabase
                .from("products")
                .select("*")
                .eq(
                    "id",
                    productId
                )
                .single();


            if (
                productError ||
                !product
            ) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Product not found"
                    });
            }


            console.log(
                `Starting scrape for ${product.product_name}`
            );


            const result =
                await scrapeWithRetry(
                    product.product_url
                );


            /*
             * Save scrape attempts.
             */

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


                const {
                    error:
                        logsError
                } = await supabase
                    .from(
                        "scrape_logs"
                    )
                    .insert(logs);


                if (logsError) {

                    console.error(
                        "Failed to save scrape logs:",
                        logsError.message
                    );
                }
            }


            /*
             * Only save price and stock
             * when scrape succeeds.
             */

            if (result.success) {

                const {
                    data:
                        historyData,
                    error:
                        historyError
                } = await supabase
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
                    .single();


                if (historyError) {

                    return res
                        .status(500)
                        .json({
                            error:
                                historyError.message
                        });
                }


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
             * Failed scrape.
             */

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
                "Scrape endpoint failed:",
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
SCRAPE ALL TRACKED PRODUCTS
========================================
*/

app.post(
    "/api/cron/scrape-all",
    async (req, res) => {

        try {

            const {
                data: products,
                error
            } = await supabase
                .from("products")
                .select("*");


            if (error) {

                return res
                    .status(500)
                    .json({
                        error:
                            error.message
                    });
            }


            const results = [];


            for (
                const product of
                products
            ) {

                console.log(
                    `Cron scraping: ${product.product_name}`
                );


                const result =
                    await scrapeWithRetry(
                        product.product_url
                    );


                /*
                 * Save logs.
                 */

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


                    await supabase
                        .from(
                            "scrape_logs"
                        )
                        .insert(logs);
                }


                /*
                 * Save history only
                 * after successful scrape.
                 */

                if (result.success) {

                    await supabase
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
                        });
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
            } = await supabase
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
            } = await supabase
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