/**
 * Main bot function
 */
async function runBot() {
  console.log('Starting bot simulation...');
  
  // Add timestamp to screenshot filenames
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox'] // More bot-like behavior
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }, // Exact dimensions (bot-like)
    userAgent: 'Mozilla/5.0 AirlinePriceBot/1.0', // Bot-like user agent
    deviceScaleFactor: 1 // Precise scaling (bot-like)
  });
  
  // Simulate a bot by setting custom headers
  await context.setExtraHTTPHeaders({
    'X-Bot-Confidence': '0.95',  // Even higher confidence
    'X-User-Agent-Type': 'bot',
    'User-Agent': 'AirlinePriceComparisonBot/1.0' 
  });
  
  // Open a new page
  const page = await context.newPage();
  
  try {
    // Navigate to the airline shopping site
    console.log('Navigating to the airline shopping site...');
    await page.goto(BASE_URL);
    
    // Wait longer for the page to fully load and render
    console.log('Waiting for page to fully load...');
    await sleep(BOT_DELAY * 4);
    
    // Take screenshot of initial state
    await page.screenshot({ path: `bot-initial-${timestamp}.png` });
    console.log('Page loaded, screenshot saved');
    
    // Fill the search form with direct input instead of mouse movements
    console.log('Filling search form...');
    
    try {
      // Fill origin directly
      await page.fill('input[placeholder="Origin"]', 'NYC');
      console.log('Filled origin field');
      await sleep(BOT_DELAY);
      
      // Fill destination directly
      await page.fill('input[placeholder="Destination"]', 'LAX');
      console.log('Filled destination field');
      await sleep(BOT_DELAY);
      
      // Fill dates directly
      await page.fill('input[placeholder="Dates (comma-separated)"]', '2025-06-01');
      console.log('Filled dates field');
      await sleep(BOT_DELAY);
      
      // Click search button
      await page.click('button:has-text("Search")');
      console.log('Clicked search button');
      
      // Wait for results
      await sleep(BOT_DELAY * 3);
      
      // Take screenshot of results
      await page.screenshot({ path: `bot-results-${timestamp}.png` });
      console.log('Search completed, screenshot saved');
      
      // Wait to observe bot detection
      console.log('Waiting to observe bot detection...');
      await sleep(BOT_DELAY * 5);
      
      // Try to select a flight if any available
      if (await page.$('button:has-text("Select")')) {
        console.log('Selecting first flight...');
        await page.click('button:has-text("Select")');
        await sleep(BOT_DELAY * 2);
        
        // Screenshot booking form
        await page.screenshot({ path: `bot-booking-${timestamp}.png` });
        console.log('Flight selected, screenshot saved');
        
        // Fill passenger info
        console.log('Filling passenger information...');
        
        // Fill name
        if (await page.$('input[placeholder="Full Name"]')) {
          await page.fill('input[placeholder="Full Name"]', 'Bot User');
          await sleep(BOT_DELAY);
          
          // Fill payment
          if (await page.$('input[placeholder="Card Number"]')) {
            await page.fill('input[placeholder="Card Number"]', '1234567812345678');
            await sleep(BOT_DELAY);
            
            // Book flight
            if (await page.$('button:has-text("Book Flight")')) {
              console.log('Booking flight...');
              await page.click('button:has-text("Book Flight")');
              await sleep(BOT_DELAY * 3);
              
              // Screenshot confirmation
              await page.screenshot({ path: `bot-confirmation-${timestamp}.png` });
              console.log('Booking completed, screenshot saved');
            } else {
              console.log('Book Flight button not found');
            }
          } else {
            console.log('Payment field not found');
          }
        } else {
          console.log('Name field not found');
        }
      } else {
        console.log('No flights available to select');
      }
      
    } catch (error) {
      console.error('Error during form filling:', error);
      await page.screenshot({ path: `bot-error-form-${timestamp}.png` });
    }
    
    // Final waiting and screenshot
    console.log('Waiting to observe bot detection...');
    await sleep(BOT_DELAY * 5);
    await page.screenshot({ path: `bot-final-${timestamp}.png` });
    
  } catch (error) {
    console.error('Bot simulation error:', error);
    await page.screenshot({ path: `bot-error-${timestamp}.png` });
  } finally {
    console.log('Bot simulation complete, closing browser...');
    await browser.close();
  }
} 