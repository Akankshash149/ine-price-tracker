# INE Price Tracker

A full-stack product price tracking application built for the INE hosted mock store.

The application allows users to search for products, track multiple products, scrape their current price and stock availability, maintain price history, and view detailed scrape logs.

## Live Application

https://ine-price-tracker-inky.vercel.app/

## GitHub Repository

https://github.com/Akankshash149/ine-price-tracker

## Features

- Search products from the INE mock store using partial or full product names
- Track multiple products
- Scrape current price and stock availability
- Playwright-based browser scraping for dynamically loaded price data
- Retry handling for slow, failed, or temporary store responses
- Graceful failure handling
- Price and stock history
- Per-product scrape logs
- Headed browser scraping
- Scheduled scraping every 2 hours
- Supabase PostgreSQL persistence
- React frontend deployed on Vercel
- Node.js/Express backend deployed on Render
- GitHub Actions scheduled scraping workflow

## Tech Stack

### Frontend

- React.js
- Vite
- Recharts

### Backend

- Node.js
- Express.js
- Playwright

### Database

- Supabase PostgreSQL

### Deployment

- Vercel
- Render
- GitHub Actions

## Architecture

```text
React Frontend
      |
      v
Render Node.js / Express Backend
      |
      +--------------------+
      |                    |
      v                    v
Playwright Scraper     Supabase PostgreSQL
      |                    |
      v                    |
INE Mock Store             |
                           |
                           v
              Price History + Scrape Logs
```

## Scraping Workflow

1. User searches for a product from the INE mock store.
2. The selected product is stored in Supabase.
3. A scrape request is sent to the backend.
4. The backend launches a Playwright browser.
5. The scraper opens the product page.
6. It performs browser interaction with the price section to trigger the dynamically loaded price.
7. The scraper validates that both price and stock information are available.
8. Valid data is stored in price history.
9. Every scrape attempt is recorded in the scrape logs.
10. Temporary failures are retried.
11. If all attempts fail, the failure is recorded and invalid price data is not stored as a successful history entry.

## Scraper Reliability

The INE mock store can sometimes respond slowly, return temporary errors, or fail during the price-loading interaction.

The scraper handles these cases using:

- Multiple scrape attempts
- Retry handling for temporary failures
- Playwright browser interaction
- Explicit validation of price and stock data
- Graceful failure handling
- Per-attempt scrape logging
- Protection against storing invalid or empty price data

The scraper returns as soon as valid price and stock data is obtained instead of waiting unnecessarily for later background retries from the storefront.

## Scheduled Scraping

Price scraping is scheduled every 2 hours using GitHub Actions.

The workflow sends an authenticated request to the backend:

```text
POST /api/cron/scrape-all
```

The backend processes all tracked products and stores successful results in Supabase.

GitHub Actions is used as an external scheduler because the Render free-tier backend may sleep when inactive.

## Environment Variables

### Backend

Create a `.env` file inside the `backend` directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_publishable_key
CRON_SECRET=your_cron_secret
```

Do not commit the `.env` file to GitHub.

The `.env` file is excluded using `.gitignore`.

### GitHub Actions

The following GitHub repository secret is required:

```text
CRON_SECRET
```

Its value must match the `CRON_SECRET` configured on the Render backend.

## Database

The application uses Supabase PostgreSQL with three main tables.

### products

Stores the products that are being tracked.

Main fields:

- Product name
- Product URL
- SKU
- Category
- Created timestamp

### price_history

Stores successful price and stock observations.

Main fields:

- Product
- Price
- Stock
- Scraped timestamp

### scrape_logs

Stores every scrape attempt.

Main fields:

- Product
- Attempt number
- Status
- Error message
- Start time
- Finish time

Possible scrape statuses include:

```text
success
retried
failed
```

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Akankshash149/ine-price-tracker.git
cd ine-price-tracker
```

### 2. Backend Setup

```bash
cd backend
npm install
npx playwright install chromium
```

Create the `.env` file with the required Supabase and cron configuration.

Start the backend:

```bash
node server.js
```

The backend runs on:

```text
http://localhost:5000
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs using the Vite development server.

## API Endpoints

Important backend endpoints include:

```text
GET  /api/products
GET  /api/store/search
POST /api/products/track
POST /api/products/:id/scrape
GET  /api/products/:id/history
GET  /api/products/:id/logs
POST /api/cron/scrape-all
```

The scheduled scraping endpoint is protected using the configured cron secret.

## Deployment

### Frontend

The React frontend is deployed on Vercel.

Live URL:

https://ine-price-tracker-inky.vercel.app/

### Backend

The Node.js/Express backend is deployed on Render.

Live backend:

https://ine-price-tracker-osy9.onrender.com/

### Database

Supabase PostgreSQL is used for persistent application data.

### Scheduled Scraping

GitHub Actions triggers the backend scraping endpoint every two hours.

## Design Decisions

Playwright was selected because the price on the mock store is dynamically revealed through browser interaction. A simple HTTP request alone was not sufficient for reliably obtaining the current price.

The scraper uses explicit validation before storing price data. This prevents empty or invalid responses from being treated as successful price observations.

Scrape attempts are logged individually so that failures and retries remain observable instead of being hidden.

The scraper accepts valid price and stock data as soon as they are obtained, rather than waiting for unnecessary background retries from the storefront.

## Reliability and Failure Handling

The scraper is designed to handle:

- Slow page responses
- Temporary HTTP errors
- Price-loading delays
- Browser interaction failures
- Retryable failures
- Complete scrape failure after all allowed attempts

Each attempt is recorded with its status and error information where applicable.

If valid price and stock information cannot be obtained, the application does not create a successful price history entry from invalid or empty data.

## Scheduled Workflow

The scheduled GitHub Actions workflow runs every two hours and sends an authenticated request to the Render backend.

The workflow uses the `CRON_SECRET` repository secret to authenticate the scheduled request.

This approach avoids relying on an always-running process inside the free-tier backend.

## Assignment Scope

The scraper only targets the INE-provided mock store:

https://demo.inelabteamdev.com/

No real retailers are scraped.
