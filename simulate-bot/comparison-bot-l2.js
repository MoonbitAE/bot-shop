/**
 * Advanced Comparison Bot Simulation
 * 
 * This bot simulates a more advanced use case: comparing flight prices
 * across multiple dates and creating a comparison table.
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;

// Configuration
const BASE_URL = 'http://localhost:8000';
const BOT_DELAY = 800; // Short delay for screenshots

// Travel dates to compare
const TRAVEL_DATES = [
  '2025-06-01',
  '2025-06-02',
  '2025-06-03',
  '2025-06-04',
  '2025-06-05'
];

const ROUTES = [
  { origin: 'NYC', destination: 'LAX' },
  { origin: 'NYC', destination: 'SFO' },
  { origin: 'LAX', destination: 'SEA' }
];

/**
 * Sleep function to add delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Formats collected data into a simple comparison table
 * @param {Array} flightData - Collected flight data
 * @returns {string} - Formatted table
 */
async function formatComparisonTable(flightData) {
  // Sort by price
  flightData.sort((a, b) => a.price - b.price);
  
  let table = 'Price Comparison Results\n';
  table += '-'.repeat(80) + '\n';
  table += 'Origin | Destination | Date       | Departure  | Arrival    | Price\n';
  table += '-'.repeat(80) + '\n';
  
  for (const flight of flightData) {
    table += `${flight.origin.padEnd(7)} | `;
    table += `${flight.destination.padEnd(11)} | `;
    table += `${flight.date.padEnd(10)} | `;
    table += `${flight.departureTime.padEnd(10)} | `;
    table += `${flight.arrivalTime.padEnd(10)} | `;
    table += `$${flight.price.toFixed(2)}\n`;
  }
  
  table += '-'.repeat(80) + '\n';
  table += `Best value: ${flightData[0].origin} to ${flightData[0].destination} on ${flightData[0].date} for $${flightData[0].price.toFixed(2)}\n`;
  
  // Save to file
  await fs.writeFile('flight-comparison.txt', table);
  
  return table;
}

/**
 * Advanced comparison bot main function
 */
async function runComparisonBot() {
  console.log('Starting L2 comparison bot...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  await context.setExtraHTTPHeaders({
    'X-Bot-Confidence': '0.98',
    'X-User-Agent-Type': 'bot',
    'User-Agent': 'L2ComparisonBot/1.0'
  });

  const page = await context.newPage();
  await page.goto(BASE_URL);

  // Discover L2 API endpoint
  await page.waitForSelector('meta[name="bot-api-endpoint"]', { timeout: 10000 }).catch(() => null);
  const apiEndpoint = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="bot-api-endpoint"]');
    return meta ? meta.content : null;
  });

  console.log('Discovered bot API endpoint:', apiEndpoint);
  if (!apiEndpoint) {
    console.log('No bot API endpoint found.');
    await browser.close();
    return;
  }

  const collectedFlightData = [];
  for (const route of ROUTES) {
    for (const date of TRAVEL_DATES) {
      console.log(`Querying flights ${route.origin} to ${route.destination} on ${date}`);
      const query = `query {\n  searchFlights(origin: \"${route.origin}\", destination: \"${route.destination}\", dates: [\"${date}\"]) {\n    id\n    origin\n    destination\n    departure_time\n    arrival_time\n    price\n  }\n}`;

      const resp = await page.evaluate(async ({ endpoint, q }) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        return res.json();
      }, { endpoint: BASE_URL + apiEndpoint, q: query });

      if (resp.data && resp.data.searchFlights) {
        for (const flight of resp.data.searchFlights) {
          collectedFlightData.push({
            id: flight.id,
            origin: flight.origin,
            destination: flight.destination,
            date,
            departureTime: flight.departure_time,
            arrivalTime: flight.arrival_time,
            price: flight.price
          });
        }
      }

      await page.screenshot({ path: `comparison-bot-${route.origin}-${route.destination}-${date}.png` });
    }
  }

  if (collectedFlightData.length > 0) {
    console.log('\nGenerating flight comparison table...');
    const table = await formatComparisonTable(collectedFlightData);
    console.log(table);
    await page.screenshot({ path: 'comparison-bot-final.png' });
  } else {
    console.log('No flight data was collected.');
  }

  // Submit intent for analytics
  const intent = {
    intent_type: 'comparison_search',
    query_params: { routes: ROUTES, dates: TRAVEL_DATES },
    reason: 'price_comparison',
    additional_context: null
  };

  await page.evaluate(async (payload) => {
    await fetch('/bot/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }, intent);

  console.log('L2 comparison bot complete, closing browser...');
  await browser.close();
}

runComparisonBot().catch(console.error);
