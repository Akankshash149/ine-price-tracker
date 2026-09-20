import { useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [history, setHistory] = useState([]);
    const [logs, setLogs] = useState([]);

    const [loading, setLoading] = useState(false);
    const [scraping, setScraping] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchProducts();
    }, []);

    async function fetchProducts(searchText = "") {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_URL}/api/products?search=${encodeURIComponent(searchText)}`
            );

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to load products");
            }

            setProducts(data.products);

            if (data.products.length > 0 && !selectedProduct) {
                selectProduct(data.products[0]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function selectProduct(product) {
        setSelectedProduct(product);
        setError("");

        await loadHistory(product.id);
        await loadLogs(product.id);
    }

    async function loadHistory(productId) {
        try {
            const response = await fetch(
                `${API_URL}/api/products/${productId}/history`
            );

            const data = await response.json();

            if (data.success) {
                setHistory(data.history);
            }
        } catch (err) {
            console.error("History error:", err);
        }
    }

    async function loadLogs(productId) {
        try {
            const response = await fetch(
                `${API_URL}/api/products/${productId}/logs`
            );

            const data = await response.json();

            if (data.success) {
                setLogs(data.logs);
            }
        } catch (err) {
            console.error("Logs error:", err);
        }
    }

    async function scrapeProduct() {
        if (!selectedProduct) return;

        try {
            setScraping(true);
            setError("");

            const response = await fetch(
                `${API_URL}/api/products/${selectedProduct.id}/scrape`,
                {
                    method: "POST",
                }
            );

            const data = await response.json();

            if (!data.success) {
                throw new Error(
                    data.message || data.error || "Scraping failed"
                );
            }

            await loadHistory(selectedProduct.id);
            await loadLogs(selectedProduct.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setScraping(false);
        }
    }

    function handleSearch(event) {
        event.preventDefault();
        fetchProducts(search);
    }

    const chartData = history.map((item) => ({
        date: new Date(item.scraped_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        }),
        price: Number(item.price),
    }));

    return (
        <div className="app">

            <header className="header">
                <div>
                    <h1>INE Price Tracker</h1>
                    <p>Track product prices and availability</p>
                </div>
            </header>

            <main className="container">

                {/* Search */}
                <section className="search-section">
                    <form onSubmit={handleSearch} className="search-form">

                        <input
                            type="text"
                            placeholder="Search product by name..."
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />

                        <button type="submit">
                            Search
                        </button>

                    </form>
                </section>


                {/* Error */}
                {error && (
                    <div className="error">
                        {error}
                    </div>
                )}


                {/* Products */}
                <section className="products-section">

                    <h2>Products</h2>

                    {loading ? (
                        <p>Loading products...</p>
                    ) : products.length === 0 ? (
                        <p>No products found.</p>
                    ) : (
                        <div className="product-list">

                            {products.map((product) => (

                                <button
                                    key={product.id}
                                    className={
                                        selectedProduct?.id === product.id
                                            ? "product-card selected"
                                            : "product-card"
                                    }
                                    onClick={() =>
                                        selectProduct(product)
                                    }
                                >

                                    <strong>
                                        {product.product_name}
                                    </strong>

                                    <span>
                                        {product.category}
                                    </span>

                                    <small>
                                        SKU: {product.sku || "N/A"}
                                    </small>

                                </button>

                            ))}

                        </div>
                    )}

                </section>


                {/* Dashboard */}
                {selectedProduct && (

                    <section className="dashboard">

                        {/* Product Header */}
                        <div className="product-header">

                            <div>
                                <h2>
                                    {selectedProduct.product_name}
                                </h2>

                                <p>
                                    {selectedProduct.category} ·{" "}
                                    {selectedProduct.sku}
                                </p>
                            </div>

                            <button
                                className="scrape-button"
                                onClick={scrapeProduct}
                                disabled={scraping}
                            >
                                {scraping
                                    ? "Scraping..."
                                    : "Refresh Price"}
                            </button>

                        </div>


                        {/* Current Price */}
                        <div className="current-card">

                            <h3>Latest Price</h3>

                            {history.length > 0 ? (
                                <>
                                    <div className="price">
                                        ₹
                                        {Number(
                                            history[history.length - 1].price
                                        ).toLocaleString("en-IN")}
                                    </div>

                                    <div className="stock">
                                        {history[history.length - 1].stock}
                                    </div>

                                    <small>
                                        Last updated:{" "}
                                        {new Date(
                                            history[history.length - 1]
                                                .scraped_at
                                        ).toLocaleString()}
                                    </small>
                                </>
                            ) : (
                                <p>No price data available yet.</p>
                            )}

                        </div>


                        {/* Price Chart */}
                        <div className="panel">

                            <h3>Price Trend</h3>

                            {chartData.length < 2 ? (
                                <p>
                                    At least two price records are needed
                                    to display the price trend.
                                </p>
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 320,
                                    }}
                                >
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <LineChart
                                            data={chartData}
                                            margin={{
                                                top: 10,
                                                right: 20,
                                                left: 10,
                                                bottom: 10,
                                            }}
                                        >

                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                            />

                                            <XAxis dataKey="date" />

                                            <YAxis
                                                tickFormatter={(value) =>
                                                    `₹${value.toLocaleString(
                                                        "en-IN"
                                                    )}`
                                                }
                                            />

                                            <Tooltip
                                                formatter={(value) =>
                                                    `₹${Number(
                                                        value
                                                    ).toLocaleString(
                                                        "en-IN"
                                                    )}`
                                                }
                                            />

                                            <Line
                                                type="monotone"
                                                dataKey="price"
                                                strokeWidth={3}
                                                dot={{ r: 5 }}
                                                activeDot={{ r: 7 }}
                                            />

                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                        </div>


                        {/* Price History Table */}
                        <div className="panel">

                            <h3>Price History</h3>

                            {history.length === 0 ? (
                                <p>No history available.</p>
                            ) : (
                                <div className="table-wrapper">

                                    <table>

                                        <thead>
                                            <tr>
                                                <th>Date & Time</th>
                                                <th>Price</th>
                                                <th>Stock</th>
                                            </tr>
                                        </thead>

                                        <tbody>

                                            {history.map((item) => (

                                                <tr key={item.id}>

                                                    <td>
                                                        {new Date(
                                                            item.scraped_at
                                                        ).toLocaleString()}
                                                    </td>

                                                    <td>
                                                        ₹
                                                        {Number(
                                                            item.price
                                                        ).toLocaleString(
                                                            "en-IN"
                                                        )}
                                                    </td>

                                                    <td>
                                                        {item.stock}
                                                    </td>

                                                </tr>

                                            ))}

                                        </tbody>

                                    </table>

                                </div>
                            )}

                        </div>


                        {/* Scrape Logs */}
                        <div className="panel">

                            <h3>Scrape Logs</h3>

                            {logs.length === 0 ? (
                                <p>No scrape attempts yet.</p>
                            ) : (
                                <div className="table-wrapper">

                                    <table>

                                        <thead>
                                            <tr>
                                                <th>Attempt</th>
                                                <th>Status</th>
                                                <th>Started</th>
                                                <th>Finished</th>
                                                <th>Error</th>
                                            </tr>
                                        </thead>

                                        <tbody>

                                            {logs.map((log) => (

                                                <tr key={log.id}>

                                                    <td>
                                                        {log.attempt_number}
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`status ${log.status}`}
                                                        >
                                                            {log.status}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {new Date(
                                                            log.started_at
                                                        ).toLocaleString()}
                                                    </td>

                                                    <td>
                                                        {new Date(
                                                            log.finished_at
                                                        ).toLocaleString()}
                                                    </td>

                                                    <td>
                                                        {log.error_message ||
                                                            "-"}
                                                    </td>

                                                </tr>

                                            ))}

                                        </tbody>

                                    </table>

                                </div>
                            )}

                        </div>

                    </section>

                )}

            </main>

        </div>
    );
}

export default App;