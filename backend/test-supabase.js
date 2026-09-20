const supabase = require("./supabase");
const { scrapeWithRetry } = require("./scraper/productScraper");

(async () => {
    try {
        // 1. Get tracked product
        const { data: product, error: productError } = await supabase
            .from("products")
            .select("*")
            .eq("id", 1)
            .single();

        if (productError) {
            throw productError;
        }

        console.log("Tracking product:", product.product_name);

        // 2. Scrape current price and stock
        const result = await scrapeWithRetry(
            product.product_url,
            3
        );

        if (!result.success) {
            throw new Error("Scraping failed after all attempts.");
        }

        console.log("Scraped price:", result.price);
        console.log("Scraped stock:", result.stock);

        // 3. Convert price text into number
        const price = Number(
            result.price.replace(/[^\d.]/g, "")
        );

        if (isNaN(price)) {
            throw new Error("Invalid price received: " + result.price);
        }

        // 4. Save price + stock history
        const { data: history, error: historyError } = await supabase
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

        console.log("\nPrice history saved successfully!");
        console.log(history);

        // 5. Save scrape logs
        for (const attempt of result.attempts) {

            const { error: logError } = await supabase
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

        console.log("Scrape logs saved successfully!");

    } catch (error) {

        console.error("\nERROR:");
        console.error(error.message);

    }
})();