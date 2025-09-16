# Crypto Watchlist MVP

This is a minimal crypto watchlist web app that provides real-time price data for a user-selected list of cryptocurrencies.

## Features

- Display a table of coins with their name, ticker, price (USD), and 24-hour change (%).
- Search for and add coins from CoinGecko's top 100 list.
- Remove coins from the watchlist.
- Real-time price updates every 30 seconds.
- Responsive design for both mobile and desktop.

## Tech Stack

- **Frontend:** React (Vite), Tailwind CSS
- **Data Fetching:** @tanstack/react-query
- **API:** CoinGecko

## Setup and Local Development

1. **Clone the repository:**
   \`\`\`bash
   git clone https://github.com/GenJess/Crypto_Momentum_Tracker.git
   cd Crypto_Momentum_Tracker
   \`\`\`

2. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables:**
   Create a `.env` file in the root of the project and add the following line:
   \`\`\`
   VITE_API_BASE_URL=https://api.coingecko.com/api/v3
   \`\`\`

4. **Run the development server:**
   \`\`\`bash
   npm run dev
   \`\`\`
   The application will be available at `http://localhost:5173`.

## API Endpoints Used

The application uses the following CoinGecko API endpoints:

- `GET /api/v3/coins/markets`: To fetch the list of top 100 cryptocurrencies for the search functionality.
  - Parameters: `vs_currency=usd`, `order=market_cap_desc`, `per_page=100`
- `GET /api/v3/simple/price`: To fetch real-time price and 24-hour change data for the coins in the watchlist.
  - Parameters: `ids=<coin_ids>`, `vs_currencies=usd`, `include_24hr_change=true`

## Deployment

This project is configured for automatic deployment to Vercel. Any push to the `jules` branch will trigger a new deployment.

To deploy manually or to a different Vercel project:

1. **Install the Vercel CLI:**
   \`\`\`bash
   npm install -g vercel
   \`\`\`

2. **Deploy the project:**
   \`\`\`bash
   vercel --prod
   \`\`\`
   Follow the prompts to link the project to your Vercel account. Vercel will automatically detect that this is a Vite project and configure the build settings accordingly.
