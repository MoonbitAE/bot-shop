const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8000';

async function runL2Bot() {
  console.log('Starting L2 API bot...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  await context.setExtraHTTPHeaders({
    'X-Bot-Confidence': '0.98',
    'X-User-Agent-Type': 'bot',
    'User-Agent': 'L2BotDemo/1.0'
  });

  const page = await context.newPage();
  await page.goto(BASE_URL);

  // Give the page time to run bot detection and expose the meta tag
  await page.waitForSelector('meta[name="bot-api-endpoint"]', { timeout: 10000 }).catch(() => null);

  const apiEndpoint = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="bot-api-endpoint"]');
    return meta ? meta.content : null;
  });

  console.log('Discovered bot API endpoint:', apiEndpoint);

  if (apiEndpoint) {
    const query = `query {\n  searchFlights(origin: \"NYC\", destination: \"LAX\", dates: [\"2025-06-01\"]) {\n    id\n    origin\n    destination\n    price\n  }\n}`;
    const resp = await fetch(BASE_URL + apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await resp.json();
    console.log('API response:', JSON.stringify(data, null, 2));
  } else {
    console.log('No bot API hint found.');
  }

  await browser.close();
  console.log('L2 API bot complete.');
}

runL2Bot().catch(e => {
  console.error(e);
  process.exit(1);
});
