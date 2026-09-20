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

        console.log("Page loaded.");

        await page.waitForTimeout(3000);

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
                console.log(
                    "Cookie popup found. Accepting..."
                );

                await acceptButton.click();

                await page.waitForTimeout(1000);
            }
        } catch (error) {
            console.log(
                "No cookie popup detected."
            );
        }


        // =================================
        // PAGE INFORMATION
        // =================================

        const information =
            await page.evaluate(() => {

                const allLinks =
                    Array.from(
                        document.querySelectorAll("a")
                    );

                const buttons =
                    Array.from(
                        document.querySelectorAll("button")
                    );

                const headings =
                    Array.from(
                        document.querySelectorAll(
                            "h1,h2,h3,h4,h5,h6"
                        )
                    );


                return {

                    title:
                        document.title,

                    url:
                        window.location.href,

                    bodyText:
                        document.body.innerText
                            .slice(0, 5000),

                    totalLinks:
                        allLinks.length,

                    links:
                        allLinks
                            .slice(0, 100)
                            .map(link => ({
                                text:
                                    (
                                        link.innerText ||
                                        link.textContent ||
                                        ""
                                    ).trim(),

                                href:
                                    link.href
                            })),

                    totalButtons:
                        buttons.length,

                    buttons:
                        buttons
                            .slice(0, 50)
                            .map(button => ({
                                text:
                                    (
                                        button.innerText ||
                                        button.textContent ||
                                        ""
                                    ).trim(),

                                ariaLabel:
                                    button.getAttribute(
                                        "aria-label"
                                    )
                            })),

                    headings:
                        headings
                            .slice(0, 50)
                            .map(heading =>
                                (
                                    heading.innerText ||
                                    heading.textContent ||
                                    ""
                                ).trim()
                            )
                };
            });


        console.log(
            "\n================================="
        );

        console.log(
            "PAGE INFORMATION"
        );

        console.log(
            "=================================\n"
        );


        console.log(
            "TITLE:"
        );

        console.log(
            information.title
        );


        console.log(
            "\nURL:"
        );

        console.log(
            information.url
        );


        console.log(
            "\nTOTAL LINKS:"
        );

        console.log(
            information.totalLinks
        );


        console.log(
            "\nLINKS:"
        );

        console.log(
            JSON.stringify(
                information.links,
                null,
                2
            )
        );


        console.log(
            "\nTOTAL BUTTONS:"
        );

        console.log(
            information.totalButtons
        );


        console.log(
            "\nBUTTONS:"
        );

        console.log(
            JSON.stringify(
                information.buttons,
                null,
                2
            )
        );


        console.log(
            "\nHEADINGS:"
        );

        console.log(
            JSON.stringify(
                information.headings,
                null,
                2
            )
        );


        console.log(
            "\nBODY TEXT:"
        );

        console.log(
            information.bodyText
        );


        console.log(
            "\n================================="
        );

        console.log(
            "END"
        );

        console.log(
            "================================="
        );


        console.log(
            "\nBrowser is staying open."
        );

        console.log(
            "Press Ctrl+C when you have checked the page."
        );


        // Keep browser open.
        await new Promise(() => {});

    } catch (error) {

        console.error(
            "\nDIAGNOSTIC FAILED:"
        );

        console.error(
            error.message
        );

        await browser.close();
    }
}

main();