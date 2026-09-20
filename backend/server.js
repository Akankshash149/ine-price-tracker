const express = require("express");
const cors = require("cors");
require("dotenv").config();

const supabase = require("./supabase");
const { scrapeWithRetry } = require("./scraper/productScraper");

const app = express();

app.use(cors());
app.use(express.json());


// ==========================================
// 1. HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
    res.json({
        message: "INE Price Tracker API is running"
    });
});


// ==========================================
// 2. GET / SEARCH PRODUCTS
// ==========================================

app.get("/api/products", async (req, res) => {
    try {
        const search = req.query.search || "";

        let query = supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (search) {
            query = query.ilike(
                "product_name",
                `%${search}%`
            );
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            products: data
        });

    } catch (error) {

        console.error(
            "Product search error:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==========================================
// 3. SCRAPE ONE PRODUCT
// ==========================================

app.post("/api/products/:id/scrape", async (req, res) => {
    try {
        const productId = req.params.id;

        // Get product
        const {
            data: product,
            error: productError
        } = await supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .single();

        if (productError) {
            throw productError;
        }

        // Run scraper with retry
        const result = await scrapeWithRetry(
            product.product_url,
            3
        );

        // Save every scrape attempt
        for (const attempt of result.attempts) {

            const { error: logError } =
                await supabase
                    .from("scrape_logs")
                    .insert([
                        {
                            product_id: product.id,
                            attempt_number: attempt.attempt,
                            status: attempt.status,
                            error_message: attempt.error,
                            started_at: attempt.startedAt,
                            finished_at: attempt.finishedAt
                        }
                    ]);

            if (logError) {
                throw logError;
            }
        }

        // Do not save incorrect data
        if (!result.success) {

            return res.status(500).json({
                success: false,
                message: "Scraping failed after all attempts.",
                attempts: result.attempts
            });
        }

        // Convert price text into number
        const price = Number(
            result.price.replace(/[^\d.]/g, "")
        );

        if (isNaN(price)) {
            throw new Error(
                "Invalid price received: " + result.price
            );
        }

        // Save price + stock history
        const {
            data: history,
            error: historyError
        } = await supabase
            .from("price_history")
            .insert([
                {
                    product_id: product.id,
                    price: price,
                    stock: result.stock
                }
            ])
            .select();

        if (historyError) {
            throw historyError;
        }

        res.json({
            success: true,
            product: product.product_name,
            price: price,
            stock: result.stock,
            history: history[0],
            attempts: result.attempts
        });

    } catch (error) {

        console.error(
            "Scrape API error:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==========================================
// 4. AUTOMATIC SCRAPE ALL PRODUCTS
// ==========================================

app.post("/api/cron/scrape-all", async (req, res) => {

    try {

        console.log("\n=================================");
        console.log("AUTOMATIC SCRAPE JOB STARTED");
        console.log("=================================");

        // Get all tracked products
        const {
            data: products,
            error: productsError
        } = await supabase
            .from("products")
            .select("*");

        if (productsError) {
            throw productsError;
        }

        console.log(
            `Products to scrape: ${products.length}`
        );

        const results = [];

        // Scrape every tracked product
        for (const product of products) {

            console.log("\n---------------------------------");
            console.log(
                `Scraping: ${product.product_name}`
            );
            console.log("---------------------------------");

            const result = await scrapeWithRetry(
                product.product_url,
                3
            );

            // Save every attempt to scrape_logs
            for (const attempt of result.attempts) {

                const { error: logError } =
                    await supabase
                        .from("scrape_logs")
                        .insert([
                            {
                                product_id: product.id,
                                attempt_number: attempt.attempt,
                                status: attempt.status,
                                error_message: attempt.error,
                                started_at: attempt.startedAt,
                                finished_at: attempt.finishedAt
                            }
                        ]);

                if (logError) {
                    console.error(
                        "Failed to save scrape log:",
                        logError.message
                    );
                }
            }

            // If scraping failed completely,
            // do NOT save price history.
            if (!result.success) {

                results.push({
                    productId: product.id,
                    product: product.product_name,
                    success: false,
                    price: null,
                    stock: null
                });

                console.log(
                    `FAILED: ${product.product_name}`
                );

                continue;
            }

            // Convert price to number
            const price = Number(
                result.price.replace(/[^\d.]/g, "")
            );

            if (isNaN(price)) {

                console.error(
                    "Invalid price:",
                    result.price
                );

                results.push({
                    productId: product.id,
                    product: product.product_name,
                    success: false,
                    price: null,
                    stock: null
                });

                continue;
            }

            // Save successful price history
            const {
                error: historyError
            } = await supabase
                .from("price_history")
                .insert([
                    {
                        product_id: product.id,
                        price: price,
                        stock: result.stock
                    }
                ]);

            if (historyError) {
                console.error(
                    "Failed to save price history:",
                    historyError.message
                );
            }

            results.push({
                productId: product.id,
                product: product.product_name,
                success: true,
                price: price,
                stock: result.stock
            });

            console.log(
                `SUCCESS: ${product.product_name} → ₹${price}`
            );
        }

        console.log("\n=================================");
        console.log("AUTOMATIC SCRAPE JOB FINISHED");
        console.log("=================================");

        res.json({
            success: true,
            message: "Automatic scrape job completed.",
            totalProducts: products.length,
            results: results
        });

    } catch (error) {

        console.error(
            "Automatic scrape job error:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==========================================
// 5. GET PRICE HISTORY
// ==========================================

app.get("/api/products/:id/history", async (req, res) => {

    try {

        const productId = req.params.id;

        const {
            data,
            error
        } = await supabase
            .from("price_history")
            .select("*")
            .eq("product_id", productId)
            .order("scraped_at", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            history: data
        });

    } catch (error) {

        console.error(
            "History API error:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==========================================
// 6. GET SCRAPE LOGS
// ==========================================

app.get("/api/products/:id/logs", async (req, res) => {

    try {

        const productId = req.params.id;

        const {
            data,
            error
        } = await supabase
            .from("scrape_logs")
            .select("*")
            .eq("product_id", productId)
            .order("started_at", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            logs: data
        });

    } catch (error) {

        console.error(
            "Logs API error:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});