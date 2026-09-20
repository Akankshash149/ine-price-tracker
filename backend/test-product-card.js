const { chromium } = require("playwright");

async function main() {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    try {
        console.log("Opening store...");

        await page.goto(
            "https://demo.inelabteamdev.com/",
            {
                waitUntil: "domcontentloaded",
                timeout: 30000
            }
        );

        await page.waitForTimeout(2000);

        // Accept cookies if visible
        try {
            const acceptButton =
                page.getByRole("button", {
                    name: /^accept$/i
                });

            if (
                await acceptButton.isVisible({
                    timeout: 2000
                })
            ) {
                await acceptButton.click();
                await page.waitForTimeout(500);
            }
        } catch (error) {
            // No cookie popup.
        }

        // Find first product heading
        const heading =
            page.getByRole("heading", {
                name: "Nordkraft Slimbook Pro",
                exact: true
            });

        console.log(
            "Product heading found:",
            await heading.isVisible()
        );

        // Print the heading's parent HTML
        const html =
            await heading.evaluate(
                element => {
                    let current = element;

                    for (let i = 0; i < 6; i++) {
                        if (!current.parentElement) {
                            break;
                        }

                        current =
                            current.parentElement;
                    }

                    return current.outerHTML;
                }
            );

        console.log(
            "\n================================="
        );

        console.log(
            "PRODUCT CARD HTML"
        );

        console.log(
            "=================================\n"
        );

        console.log(html);

        console.log(
            "\n================================="
        );

        console.log(
            "ALL VIEW DETAILS BUTTONS"
        );

        console.log(
            "=================================\n"
        );

        const buttons =
            await page
                .getByRole("button", {
                    name: /view details/i
                })
                .all();

        console.log(
            "Number of View Details buttons:",
            buttons.length
        );

        for (
            let i = 0;
            i < buttons.length;
            i++
        ) {
            console.log(
                `Button ${i + 1}:`,
                await buttons[i].isVisible()
            );
        }

        console.log(
            "\nBrowser is staying open."
        );

        console.log(
            "Press Ctrl+C after checking the output."
        );

        await new Promise(() => {});

    } catch (error) {

        console.error(
            "Diagnostic failed:"
        );

        console.error(
            error.message
        );

        await browser.close();
    }
}

main();