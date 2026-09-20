const {
    discoverStoreProducts
} = require("./scraper/storeDiscovery");

async function main() {
    console.log(
        "Starting store discovery...\n"
    );

    const result =
        await discoverStoreProducts(
            "Vista"
        );

    console.log(
        "\n=============================="
    );

    console.log(
        "DISCOVERY RESULT"
    );

    console.log(
        "=============================="
    );

    console.log(
        `Success: ${result.success}`
    );

    console.log(
        `Total products: ${result.totalProducts}`
    );

    console.log(
        `Total pages: ${result.totalPages}`
    );

    console.log(
        `Matching products: ${result.products.length}`
    );

    console.log(
        "\nMatching products:\n"
    );

    console.log(
        JSON.stringify(
            result.products,
            null,
            2
        )
    );
}

main();