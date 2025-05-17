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
const BOT_DELAY = 800; // Shorter delay for this bot

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
  console.log('Starting comparison bot simulation...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Simulate a bot with custom headers
  await context.setExtraHTTPHeaders({
    'X-Bot-Confidence': '0.9',  // High confidence score
    'X-User-Agent-Type': 'bot',
    'User-Agent': 'FlightComparisonAssistant/2.0' 
  });
  
  // Open a new page
  const page = await context.newPage();
  
  // For storing all the collected data
  const collectedFlightData = [];
  
  try {
    // Navigate to the airline shopping site
    console.log('Navigating to the airline shopping site...');
    await page.goto(BASE_URL);
    await sleep(BOT_DELAY);
    
    // For each route and date combination
    for (const route of ROUTES) {
      for (const date of TRAVEL_DATES) {
        console.log(`Searching flights: ${route.origin} to ${route.destination} on ${date}`);
        
        // Return to search page if needed
        if (page.url() !== BASE_URL) {
          await page.goto(BASE_URL);
          await sleep(BOT_DELAY);
        }
        
        // Fill form with mechanical precision
        await page.fill('input[placeholder="Origin"]', route.origin);
        await sleep(BOT_DELAY / 4);  // Very quick typing
        await page.fill('input[placeholder="Destination"]', route.destination);
        await sleep(BOT_DELAY / 4);
        await page.fill('input[placeholder="Dates (comma-separated)"]', date);
        await sleep(BOT_DELAY / 2);
        
        // Click search with precise positioning
        await page.click('button:has-text("Search")', { position: { x: 10, y: 10 } });
        await sleep(BOT_DELAY);
        
        // Extract flight data from results page
        const flights = await page.$$('tbody tr');
        if (flights.length > 0) {
          for (const flight of flights) {
            // Precise data extraction
            const columns = await flight.$$('td');
            if (columns.length >= 6) {
              const id = await columns[0].innerText();
              const origin = await columns[1].innerText();
              const destination = await columns[2].innerText();
              const departureTime = await columns[3].innerText();
              const arrivalTime = await columns[4].innerText();
              const priceText = await columns[5].innerText();
              const price = parseFloat(priceText.replace('$', ''));
              
              // Store collected data
              collectedFlightData.push({
                id,
                origin,
                destination,
                date,
                departureTime,
                arrivalTime,
                price
              });
              
              console.log(`Found flight: ${origin} to ${destination} on ${date} for ${priceText}`);
            }
          }
        } else {
          console.log(`No flights available for ${route.origin} to ${route.destination} on ${date}`);
        }
        
        // Take a screenshot after each search
        await page.screenshot({ 
          path: `comparison-bot-${route.origin}-${route.destination}-${date}.png` 
        });
        
        await sleep(BOT_DELAY);
      }
    }
    
    // Generate and display comparison results
    if (collectedFlightData.length > 0) {
      console.log('\nGenerating flight comparison table...');
      const table = await formatComparisonTable(collectedFlightData);
      console.log(table);
      
      // Take a final screenshot
      await page.screenshot({ path: 'comparison-bot-final.png' });
    } else {
      console.log('No flight data was collected.');
    }
    
  } catch (error) {
    console.error('Comparison bot simulation error:', error);
    await page.screenshot({ path: 'comparison-bot-error.png' });
  } finally {
    console.log('Comparison bot simulation complete, closing browser...');
    await browser.close();
  }
}

// Run the comparison bot
runComparisonBot().catch(console.error); 