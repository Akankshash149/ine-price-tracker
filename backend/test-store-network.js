const { chromium } = require("playwright");

async function main() {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    console.log("Opening store...\n");

    page.on("request", request => {
        const url = request.url();

        if (
            url.includes("/api/") ||
            url.includes("product")
        ) {
            console.log(
                "REQUEST:",
                request.method(),
                url
            );
        }
    });

    page.on("response", async response => {
        const url = response.url();

        if (
            url.includes("/api/") ||
            url.includes("product")
        ) {
            console.log(
                "RESPONSE:",
                response.status(),
                url
            );

            const contentType =
                response.headers()["content-type"] || "";

            if (contentType.includes("application/json")) {
                try {
                    const data = await response.json();

                    console.log(
                        "JSON RESPONSE:"
                    );

                    console.log(
                        JSON.stringify(
                            data,
                            null,
                            2
                        ).slice(0, 10000)
                    );

                    console.log(
                        "\n------------------------------\n"
                    );
                } catch (error) {
                    console.log(
                        "Could not read JSON:",
                        error.message
                    );
                }
            }
        }
    });

    await page.goto(
        "https://demo.inelabteamdev.com/",
        {
            waitUntil: "domcontentloaded",
            timeout: 30000
        }
    );

    console.log("\nPage loaded.");

    await page.waitForTimeout(5000);

    console.log(
        "\nFinished network inspection."
    );

    console.log(
        "Press Ctrl+C after checking the output."
    );

    await new Promise(() => {});
}

main().catch(error => {
    console.error(
        "Network test failed:",
        error.message
    );
});