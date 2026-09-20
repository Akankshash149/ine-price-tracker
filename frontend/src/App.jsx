import { useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";

const API_URL = "http://localhost:5000";

function App() {

    const [trackedProducts, setTrackedProducts] =
        useState([]);

    const [selectedProduct, setSelectedProduct] =
        useState(null);

    const [history, setHistory] =
        useState([]);

    const [logs, setLogs] =
        useState([]);

    const [search, setSearch] =
        useState("");

    const [searchResults, setSearchResults] =
        useState([]);

    const [searching, setSearching] =
        useState(false);

    const [tracking, setTracking] =
        useState(null);

    const [loading, setLoading] =
        useState(false);

    const [message, setMessage] =
        useState("");


    /*
    ========================================
    LOAD TRACKED PRODUCTS
    ========================================
    */

    async function loadTrackedProducts() {

        try {

            const response =
                await fetch(
                    `${API_URL}/api/products`
                );

            const data =
                await response.json();

            setTrackedProducts(data);

            /*
             * Select first product automatically
             * if nothing is selected.
             */

            if (
                data.length > 0 &&
                !selectedProduct
            ) {
                setSelectedProduct(data[0]);
            }

        } catch (error) {

            console.error(
                "Failed to load products:",
                error
            );

        }
    }


    /*
    ========================================
    LOAD HISTORY
    ========================================
    */

    async function loadHistory(
        productId
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/api/products/${productId}/history`
                );

            const data =
                await response.json();

            setHistory(data);

        } catch (error) {

            console.error(
                "Failed to load history:",
                error
            );

        }
    }


    /*
    ========================================
    LOAD SCRAPE LOGS
    ========================================
    */

    async function loadLogs(
        productId
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/api/products/${productId}/logs`
                );

            const data =
                await response.json();

            setLogs(data);

        } catch (error) {

            console.error(
                "Failed to load logs:",
                error
            );

        }
    }


    /*
    ========================================
    SELECT PRODUCT
    ========================================
    */

    function selectProduct(product) {

        setSelectedProduct(product);

        loadHistory(product.id);

        loadLogs(product.id);
    }


    /*
    ========================================
    INITIAL LOAD
    ========================================
    */

    useEffect(() => {

        loadTrackedProducts();

    }, []);


    /*
    ========================================
    LOAD DATA WHEN PRODUCT CHANGES
    ========================================
    */

    useEffect(() => {

        if (selectedProduct) {

            loadHistory(
                selectedProduct.id
            );

            loadLogs(
                selectedProduct.id
            );
        }

    }, [selectedProduct]);


    /*
    ========================================
    SEARCH STORE
    ========================================
    */

    async function searchStore() {

        const query =
            search.trim();

        if (!query) {

            setSearchResults([]);

            return;
        }


        setSearching(true);

        setMessage("");


        try {

            const response =
                await fetch(
                    `${API_URL}/api/store/search?q=${encodeURIComponent(query)}`
                );


            const data =
                await response.json();


            if (!data.success) {

                throw new Error(
                    data.error ||
                    "Search failed"
                );
            }


            setSearchResults(
                data.products || []
            );

        } catch (error) {

            console.error(
                "Store search failed:",
                error
            );

            setMessage(
                "Unable to search the store."
            );

        } finally {

            setSearching(false);
        }
    }


    /*
    ========================================
    TRACK PRODUCT
    ========================================
    */

    async function trackProduct(
        product
    ) {

        setTracking(product.id);

        setMessage("");


        try {

            const response =
                await fetch(
                    `${API_URL}/api/products/track`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            id:
                                product.id,

                            product_name:
                                product.name,

                            brand:
                                product.brand,

                            category:
                                product.category,

                            sku:
                                product.sku,

                            product_url:
                                `https://demo.inelabteamdev.com/product/${product.id}`
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Failed to track product"
                );
            }


            /*
             * Refresh tracked products.
             */

            await loadTrackedProducts();


            /*
             * Select newly tracked product.
             */

            if (data.product) {

                setSelectedProduct(
                    data.product
                );

                await loadHistory(
                    data.product.id
                );

                await loadLogs(
                    data.product.id
                );
            }


            if (
                data.alreadyTracked
            ) {

                setMessage(
                    "This product is already being tracked."
                );

            } else {

                setMessage(
                    "Product added to tracking."
                );
            }

        } catch (error) {

            console.error(
                "Track product failed:",
                error
            );

            setMessage(
                error.message
            );

        } finally {

            setTracking(null);
        }
    }


    /*
    ========================================
    SCRAPE / REFRESH PRICE
    ========================================
    */

    async function refreshPrice() {

        if (!selectedProduct) {
            return;
        }


        setLoading(true);

        setMessage("");


        try {

            const response =
                await fetch(
                    `${API_URL}/api/products/${selectedProduct.id}/scrape`,
                    {
                        method: "POST"
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Scraping failed"
                );
            }


            /*
             * Update selected product data
             * by refreshing DB products.
             */

            await loadTrackedProducts();


            await loadHistory(
                selectedProduct.id
            );

            await loadLogs(
                selectedProduct.id
            );


            setMessage(
                `Price updated: ₹${Number(
                    data.price
                ).toLocaleString("en-IN")}`
            );

        } catch (error) {

            console.error(
                "Refresh failed:",
                error
            );

            setMessage(
                `Scrape failed: ${error.message}`
            );

            await loadLogs(
                selectedProduct.id
            );

        } finally {

            setLoading(false);
        }
    }


    /*
    ========================================
    FORMAT DATE
    ========================================
    */

    function formatDate(
        value
    ) {

        if (!value) {
            return "-";
        }

        return new Date(
            value
        ).toLocaleString(
            "en-IN"
        );
    }


    /*
    ========================================
    LATEST HISTORY
    ========================================
    */

    const latestHistory =
        history.length > 0
            ? history[
                history.length - 1
            ]
            : null;


    /*
    ========================================
    CHART DATA
    ========================================
    */

    const chartData =
        history.map(
            item => ({

                date:
                    new Date(
                        item.scraped_at
                    ).toLocaleTimeString(
                        "en-IN",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    ),

                price:
                    Number(item.price)
            })
        );


    return (

        <div
            style={{
                minHeight: "100vh",
                background: "#f5f7fb",
                padding: "30px",
                fontFamily:
                    "Arial, sans-serif"
            }}
        >

            <div
                style={{
                    maxWidth: "1200px",
                    margin: "0 auto"
                }}
            >

                {/* HEADER */}

                <h1>
                    INE Price Tracker
                </h1>

                <p
                    style={{
                        color: "#666"
                    }}
                >
                    Search products from the
                    INE mock store and track
                    their prices.
                </p>


                {/* SEARCH */}

                <div
                    style={{
                        background: "white",
                        padding: "20px",
                        borderRadius: "10px",
                        marginBottom: "25px"
                    }}
                >

                    <h2>
                        Search Store
                    </h2>


                    <div
                        style={{
                            display: "flex",
                            gap: "10px"
                        }}
                    >

                        <input
                            value={search}
                            onChange={event =>
                                setSearch(
                                    event.target.value
                                )
                            }
                            onKeyDown={event => {

                                if (
                                    event.key ===
                                    "Enter"
                                ) {
                                    searchStore();
                                }

                            }}
                            placeholder="Search product name..."
                            style={{
                                flex: 1,
                                padding: "12px",
                                border:
                                    "1px solid #ccc",
                                borderRadius:
                                    "6px",
                                fontSize:
                                    "16px"
                            }}
                        />


                        <button
                            onClick={
                                searchStore
                            }
                            disabled={searching}
                            style={{
                                padding:
                                    "12px 20px",
                                cursor:
                                    "pointer"
                            }}
                        >
                            {searching
                                ? "Searching..."
                                : "Search"}
                        </button>

                    </div>


                    {/* SEARCH RESULTS */}

                    {searchResults.length >
                        0 && (

                        <div
                            style={{
                                marginTop:
                                    "20px"
                            }}
                        >

                            <h3>
                                Search Results
                            </h3>


                            {searchResults.map(
                                product => (

                                    <div
                                        key={
                                            product.id
                                        }
                                        style={{
                                            border:
                                                "1px solid #ddd",
                                            padding:
                                                "15px",
                                            borderRadius:
                                                "8px",
                                            marginBottom:
                                                "10px",
                                            display:
                                                "flex",
                                            justifyContent:
                                                "space-between",
                                            alignItems:
                                                "center"
                                        }}
                                    >

                                        <div>

                                            <strong>
                                                {
                                                    product.name
                                                }
                                            </strong>

                                            <div
                                                style={{
                                                    color:
                                                        "#666",
                                                    marginTop:
                                                        "5px"
                                                }}
                                            >
                                                {
                                                    product.category
                                                }
                                                {" · "}
                                                SKU:{" "}
                                                {
                                                    product.sku
                                                }
                                            </div>

                                            <div
                                                style={{
                                                    fontSize:
                                                        "13px",
                                                    color:
                                                        "#888"
                                                }}
                                            >
                                                Brand:{" "}
                                                {
                                                    product.brand
                                                }
                                            </div>

                                        </div>


                                        <button
                                            onClick={() =>
                                                trackProduct(
                                                    product
                                                )
                                            }
                                            disabled={
                                                tracking ===
                                                product.id
                                            }
                                            style={{
                                                padding:
                                                    "9px 15px",
                                                cursor:
                                                    "pointer"
                                            }}
                                        >
                                            {tracking ===
                                            product.id
                                                ? "Adding..."
                                                : "Track Product"}
                                        </button>

                                    </div>

                                )
                            )}

                        </div>

                    )}


                    {search &&
                        !searching &&
                        searchResults.length ===
                            0 && (

                        <p
                            style={{
                                color:
                                    "#777",
                                marginTop:
                                    "15px"
                            }}
                        >
                            No products found.
                        </p>
                    )}

                </div>


                {/* MESSAGE */}

                {message && (

                    <div
                        style={{
                            background:
                                "#e8f4ff",
                            padding:
                                "12px",
                            borderRadius:
                                "6px",
                            marginBottom:
                                "20px"
                        }}
                    >
                        {message}
                    </div>

                )}


                {/* MAIN CONTENT */}

                <div
                    style={{
                        display:
                            "grid",
                        gridTemplateColumns:
                            "280px 1fr",
                        gap:
                            "25px"
                    }}
                >

                    {/* TRACKED PRODUCTS */}

                    <div
                        style={{
                            background:
                                "white",
                            padding:
                                "20px",
                            borderRadius:
                                "10px",
                            height:
                                "fit-content"
                        }}
                    >

                        <h2>
                            Tracked Products
                        </h2>


                        {trackedProducts.length ===
                            0 && (

                            <p
                                style={{
                                    color:
                                        "#777"
                                }}
                            >
                                No products tracked yet.
                            </p>
                        )}


                        {trackedProducts.map(
                            product => (

                                <div
                                    key={
                                        product.id
                                    }
                                    onClick={() =>
                                        selectProduct(
                                            product
                                        )
                                    }
                                    style={{
                                        padding:
                                            "12px",
                                        marginBottom:
                                            "8px",
                                        border:
                                            selectedProduct?.id ===
                                            product.id
                                                ? "2px solid #333"
                                                : "1px solid #ddd",
                                        borderRadius:
                                            "7px",
                                        cursor:
                                            "pointer"
                                    }}
                                >

                                    <strong>
                                        {
                                            product.product_name
                                        }
                                    </strong>

                                    <div
                                        style={{
                                            color:
                                                "#777",
                                            fontSize:
                                                "13px",
                                            marginTop:
                                                "4px"
                                        }}
                                    >
                                        {
                                            product.category
                                        }
                                        {" · "}
                                        {
                                            product.sku
                                        }
                                    </div>

                                </div>

                            )
                        )}

                    </div>


                    {/* PRODUCT DETAILS */}

                    <div>

                        {!selectedProduct ? (

                            <div
                                style={{
                                    background:
                                        "white",
                                    padding:
                                        "30px",
                                    borderRadius:
                                        "10px"
                                }}
                            >
                                Select a tracked
                                product to view
                                details.
                            </div>

                        ) : (

                            <>

                                {/* PRODUCT INFO */}

                                <div
                                    style={{
                                        background:
                                            "white",
                                        padding:
                                            "25px",
                                        borderRadius:
                                            "10px",
                                        marginBottom:
                                            "20px"
                                    }}
                                >

                                    <h2>
                                        {
                                            selectedProduct.product_name
                                        }
                                    </h2>

                                    <p>
                                        Category:{" "}
                                        {
                                            selectedProduct.category
                                        }
                                    </p>

                                    <p>
                                        SKU:{" "}
                                        {
                                            selectedProduct.sku
                                        }
                                    </p>


                                    <button
                                        onClick={
                                            refreshPrice
                                        }
                                        disabled={
                                            loading
                                        }
                                        style={{
                                            padding:
                                                "12px 20px",
                                            cursor:
                                                "pointer"
                                        }}
                                    >
                                        {loading
                                            ? "Scraping..."
                                            : "Refresh Price"}
                                    </button>

                                </div>


                                {/* CURRENT PRICE */}

                                <div
                                    style={{
                                        display:
                                            "grid",
                                        gridTemplateColumns:
                                            "1fr 1fr",
                                        gap:
                                            "20px",
                                        marginBottom:
                                            "20px"
                                    }}
                                >

                                    <div
                                        style={{
                                            background:
                                                "white",
                                            padding:
                                                "20px",
                                            borderRadius:
                                                "10px"
                                        }}
                                    >

                                        <h3>
                                            Latest Price
                                        </h3>

                                        <div
                                            style={{
                                                fontSize:
                                                    "28px",
                                                fontWeight:
                                                    "bold"
                                            }}
                                        >
                                            {latestHistory
                                                ? `₹${Number(
                                                    latestHistory.price
                                                ).toLocaleString(
                                                    "en-IN"
                                                )}`
                                                : "No data"}
                                        </div>

                                    </div>


                                    <div
                                        style={{
                                            background:
                                                "white",
                                            padding:
                                                "20px",
                                            borderRadius:
                                                "10px"
                                        }}
                                    >

                                        <h3>
                                            Stock
                                        </h3>

                                        <div
                                            style={{
                                                fontSize:
                                                    "20px",
                                                fontWeight:
                                                    "bold"
                                            }}
                                        >
                                            {latestHistory
                                                ? latestHistory.stock
                                                : "No data"}
                                        </div>

                                    </div>

                                </div>


                                {/* CHART */}

                                <div
                                    style={{
                                        background:
                                            "white",
                                        padding:
                                            "20px",
                                        borderRadius:
                                            "10px",
                                        marginBottom:
                                            "20px"
                                    }}
                                >

                                    <h2>
                                        Price Trend
                                    </h2>


                                    {chartData.length >
                                    0 ? (

                                        <ResponsiveContainer
                                            width="100%"
                                            height={
                                                300
                                            }
                                        >

                                            <LineChart
                                                data={
                                                    chartData
                                                }
                                            >

                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                />

                                                <XAxis
                                                    dataKey="date"
                                                />

                                                <YAxis />

                                                <Tooltip />

                                                <Line
                                                    type="monotone"
                                                    dataKey="price"
                                                    stroke="#2563eb"
                                                    strokeWidth={
                                                        2
                                                    }
                                                />

                                            </LineChart>

                                        </ResponsiveContainer>

                                    ) : (

                                        <p>
                                            No price
                                            history yet.
                                        </p>
                                    )}

                                </div>


                                {/* HISTORY TABLE */}

                                <div
                                    style={{
                                        background:
                                            "white",
                                        padding:
                                            "20px",
                                        borderRadius:
                                            "10px",
                                        marginBottom:
                                            "20px"
                                    }}
                                >

                                    <h2>
                                        Price History
                                    </h2>


                                    <table
                                        style={{
                                            width:
                                                "100%",
                                            borderCollapse:
                                                "collapse"
                                        }}
                                    >

                                        <thead>

                                            <tr>

                                                <th
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        padding:
                                                            "10px"
                                                    }}
                                                >
                                                    Time
                                                </th>

                                                <th
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        padding:
                                                            "10px"
                                                    }}
                                                >
                                                    Price
                                                </th>

                                                <th
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        padding:
                                                            "10px"
                                                    }}
                                                >
                                                    Stock
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {history.map(
                                                item => (

                                                    <tr
                                                        key={
                                                            item.id
                                                        }
                                                    >

                                                        <td
                                                            style={{
                                                                padding:
                                                                    "10px",
                                                                borderTop:
                                                                    "1px solid #eee"
                                                            }}
                                                        >
                                                            {
                                                                formatDate(
                                                                    item.scraped_at
                                                                )
                                                            }
                                                        </td>

                                                        <td
                                                            style={{
                                                                padding:
                                                                    "10px",
                                                                borderTop:
                                                                    "1px solid #eee"
                                                            }}
                                                        >
                                                            ₹
                                                            {Number(
                                                                item.price
                                                            ).toLocaleString(
                                                                "en-IN"
                                                            )}
                                                        </td>

                                                        <td
                                                            style={{
                                                                padding:
                                                                    "10px",
                                                                borderTop:
                                                                    "1px solid #eee"
                                                            }}
                                                        >
                                                            {
                                                                item.stock
                                                            }
                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>


                                {/* SCRAPE LOGS */}

                                <div
                                    style={{
                                        background:
                                            "white",
                                        padding:
                                            "20px",
                                        borderRadius:
                                            "10px"
                                    }}
                                >

                                    <h2>
                                        Scrape Logs
                                    </h2>


                                    <table
                                        style={{
                                            width:
                                                "100%",
                                            borderCollapse:
                                                "collapse"
                                        }}
                                    >

                                        <thead>

                                            <tr>

                                                <th
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        padding:
                                                            "10px"
                                                    }}
                                                >
                                                    Attempt
                                                </th>

                                                <th
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        padding:
                                                            "10px"
                                                    }}
                                                >
                                                    Status
                                                </th>

                                                <th
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        padding:
                                                            "10px"
                                                    }}
                                                >
                                                    Time
                                                </th>

                                                <th
                                                    style={{
                                                        textAlign:
                                                            "left",
                                                        padding:
                                                            "10px"
                                                    }}
                                                >
                                                    Error
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {logs.map(
                                                log => (

                                                    <tr
                                                        key={
                                                            log.id
                                                        }
                                                    >

                                                        <td
                                                            style={{
                                                                padding:
                                                                    "10px",
                                                                borderTop:
                                                                    "1px solid #eee"
                                                            }}
                                                        >
                                                            {
                                                                log.attempt_number
                                                            }
                                                        </td>

                                                        <td
                                                            style={{
                                                                padding:
                                                                    "10px",
                                                                borderTop:
                                                                    "1px solid #eee"
                                                            }}
                                                        >
                                                            {
                                                                log.status
                                                            }
                                                        </td>

                                                        <td
                                                            style={{
                                                                padding:
                                                                    "10px",
                                                                borderTop:
                                                                    "1px solid #eee"
                                                            }}
                                                        >
                                                            {
                                                                formatDate(
                                                                    log.started_at
                                                                )
                                                            }
                                                        </td>

                                                        <td
                                                            style={{
                                                                padding:
                                                                    "10px",
                                                                borderTop:
                                                                    "1px solid #eee"
                                                            }}
                                                        >
                                                            {
                                                                log.error_message ||
                                                                "-"
                                                            }
                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            </>

                        )}

                    </div>

                </div>

            </div>

        </div>
    );
}

export default App;