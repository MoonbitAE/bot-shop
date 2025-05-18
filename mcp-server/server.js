const express = require('express');
const { chromium } = require('playwright');

const BASE_URL = process.env.AI_CESSIBLE_URL || 'http://localhost:8000';
const PORT = process.env.PORT || 3100;

async function createBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  return { browser, context, page };
}

async function main() {
  const { browser, page } = await createBrowser();
  const app = express();
  app.use(express.json());

  async function runGraphQL(query, variables) {
    return page.evaluate(async ({ q, v }) => {
      const resp = await fetch('/bot/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, variables: v })
      });
      return await resp.json();
    }, { q: query, v: variables });
  }

  app.post('/search', async (req, res) => {
    const { origin, destination, dates } = req.body;
    const query = `query($o:String!,$d:String!,$dates:[String!]!){searchFlights(origin:$o,destination:$d,dates:$dates){id origin destination departureTime arrivalTime price}}`;
    const data = await runGraphQL(query, { o: origin, d: destination, dates });
    res.json(data);
  });

  app.post('/book', async (req, res) => {
    const { passengerDetails, payment, flightId } = req.body;
    const mutation = `mutation($p:String!,$pay:String!,$f:Float!){bookFlight(passengerDetails:$p,payment:$pay,flightId:$f){bookingId flight{ id origin destination departureTime arrivalTime price }}}`;
    const data = await runGraphQL(mutation, { p: passengerDetails, pay: payment, f: flightId });
    res.json(data);
  });

  app.post('/requestExplanation', async (req, res) => {
    const { flightId } = req.body;
    const query = `query($id:Int!){requestExplanation(flightId:$id){flightId baseFare taxesFees comparativeValue cancellationPolicy seatDetails{pitchInches widthInches reclineDegrees hasPower hasWifi} structuredExplanation}}`;
    const data = await runGraphQL(query, { id: flightId });
    res.json(data);
  });

  app.post('/intent', async (req, res) => {
    const mutation = `mutation($intent: BotIntent!){submitIntent(intent:$intent)}`;
    const data = await runGraphQL(mutation, { intent: req.body });
    res.json(data);
  });

  app.post('/shutdown', async (_req, res) => {
    await browser.close();
    res.json({ ok: true });
    process.exit(0);
  });

  app.listen(PORT, () => {
    console.log(`MCP server running at http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

