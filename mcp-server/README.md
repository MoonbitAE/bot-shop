# MCP Server

This server exposes a minimal control plane for automated testing of the AI‑cessible demo using Playwright. It launches a headless browser and forwards simple JSON requests to the bot aware GraphQL API provided by the Rust backend.

## Usage

```bash
# install dependencies
npm install

# run the server
node server.js
```

Environment variables:

- `AI_CESSIBLE_URL` – Base URL of the AI‑cessible site (default `http://localhost:8000`).
- `PORT` – Port for the MCP server (default `3100`).

## Endpoints

- `POST /search` – parameters `{ origin, destination, dates }` (dates as array)
- `POST /book` – parameters `{ passengerDetails, payment, flightId }`
- `POST /requestExplanation` – `{ flightId }`
- `POST /intent` – body matches the `BotIntent` GraphQL input
- `POST /shutdown` – closes the Playwright browser

These endpoints allow external tools (for example Claude or other LLMs) to perform actions against the demo without running a browser themselves.

