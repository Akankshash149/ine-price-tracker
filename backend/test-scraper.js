const { scrapeWithRetry } = require("./scraper/productScraper");

(async () => {
    const productUrl =
        "https://demo.inelabteamdev.com/product/303";

    console.log("Starting scraper with retry...\n");

    const result = await scrapeWithRetry(productUrl, 3);

    console.log("\n=================================");
    console.log("FINAL SCRAPER RESULT");
    console.log("=================================");

    console.log("Success:", result.success);
    console.log("Price:", result.price);
    console.log("Stock:", result.stock);

    console.log("\nSCRAPE LOG:");
    console.log(JSON.stringify(result.attempts, null, 2));

    console.log("=================================");
})();