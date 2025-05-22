# AI-Cessible Airline Shopping Demo - Repository Overview

This document provides a comprehensive rundown of the AI-Cessible Airline Shopping Demo project, including its goals, components, and supporting tools.

## Project Goal and Key Components

The project aims to create a next-generation airline e-commerce platform. The main goal is to **optimize the user experience for AI shopping bots** while still supporting traditional human users.

Key components include:

*   **Frontend:** A ReactJS-based user interface.
*   **Backend:** A Rust-based server using Axum and async-graphql.
*   **AI-Cessible (Bot-Specific) APIs:** Specialized endpoints for AI bot interaction.

## Frontend

The frontend of the AI-Cessible Airline Shopping Demo is built using **ReactJS**. It comprises the following pages:

*   Flight Search Page
*   Flight Results Page
*   Passenger Information Page
*   Payment Page
*   Confirmation Page

All these pages interact with the backend by fetching data and submitting state changes through **GraphQL queries and mutations**.

A key feature of the frontend is its ability to adapt to the user. It **conditionally renders bot-aware interfaces**. This means the user interface can change or offer different elements (like an `explain-this-offer` option or an intent submission form) depending on whether a human or an AI bot is interacting with it.

## Backend

The backend is developed in **Rust** and leverages several key libraries and frameworks:

*   **Axum:** A web application framework for Rust.
*   **async-graphql:** A Rust library for building GraphQL servers.
*   **Tower:** A library for building robust networking clients and servers (likely for middleware).
*   **tracing:** A framework for instrumenting Rust programs for diagnostics.

The backend exposes core **GraphQL APIs**:

*   `searchFlights(origin, destination, dates): [FlightOffer]`
*   `buildOffer(flightId, addons): OfferSummary`
*   `bookFlight(passengerDetails, payment): BookingConfirmation`
*   `getBooking(id): BookingDetail`

Additionally, it provides **AI-Cessible (Bot-Specific) APIs** isolated via `/bot/graphql` and potentially IP/user-agent routing. These return structured, compressed JSON responses:

*   `bot/intent`: POST to record bot intent, GET to retrieve saved intents.
*   `bot/requestExplanation`: Returns structured JSON explanations of offers.
*   `bot/offerInsights`: Returns comparative reasoning metadata (e.g., seat pitch, cancellation risk).
*   `bot/negotiation`: Optional endpoint to simulate future incentive logic.
*   `bot/behaviorMetrics`: Exposes time-to-decision, retries, and other analytics.

## AI-Cessibility Principles

Inspired by accessibility standards for disabled users, **AI-cessibility** is the concept of designing web and API experiences that:

1.  **Provide structured, interpretable content** for bots (not scraped content).
2.  **Include intent tagging and outcome feedback** for bot learning.
3.  **Enable transparent offer reasoning**, like fare breakdowns and add-on justifications.
4.  **Offer negotiation, incentive, and personalization hooks** for future use.

## Bot Detection Techniques and Intelligence Classification

The platform uses middleware and GraphQL extensions to detect and classify AI bots, contributing to a "Bot-Confidence Score" used for routing.

**Techniques:**

1.  **Navigation Pattern Detection:** Analyzes timing, click entropy, and DOM interaction (scroll, mouse movement, viewport changes via JS client).
2.  **Behavioral Fingerprinting:** JS-injected micro-interactions (e.g., hover delay, form fill time).
3.  **User-Agent & Header Inspection:** Checks known bot user-agents, header anomalies, and TLS fingerprinting.
4.  **GraphQL Complexity Tracking:** Monitors field-resolution patterns typical of scripted bots.

**Bot Intelligence Classification:**
Derived by the client from the bot score, navigation patterns, and use of bot-only APIs:

*   **L0:** Low score, no bot API usage.
*   **L1:** Moderate score or minimal bot API calls.
*   **L2:** High score with repeated bot endpoint usage.

## `mcp-server` (Minimal Control Plane Server)

The `mcp-server` is designed for **automated testing** of the AI-Cessible demo using **Playwright**.

**Purpose:**
*   Launches a headless browser (managed by Playwright).
*   Forwards simple JSON requests it receives to the bot-aware GraphQL API of the main Rust backend.
This allows external tools (e.g., LLMs) to interact with the demo without managing a browser.

**Usage:**
*   Install: `npm install`
*   Run: `node server.js`
*   Env Vars:
    *   `AI_CESSIBLE_URL`: Base URL of the AI-Cessible site (default `http://localhost:8000`).
    *   `PORT`: Port for the MCP server (default `3100`).

**Endpoints (POST requests):**
*   `/search`: Parameters `{ origin, destination, dates }`.
*   `/book`: Parameters `{ passengerDetails, payment, flightId }`.
*   `/requestExplanation`: Parameters `{ flightId }`.
*   `/intent`: Body matches the `BotIntent` GraphQL input.
*   `/shutdown`: Closes the Playwright browser.

## `simulate-bot` Directory

This directory contains **Playwright-based scripts** to simulate various AI bot behaviors interacting with the AI-Cessible Airline Shopping demo.

**Purpose:** To test and demonstrate how different types of bots would use the platform.

**Available Bot Simulations:**

1.  **`bot.js` (Basic Bot):** Walks through the complete flight booking process (search, select, book), taking screenshots.
2.  **`comparison-bot.js` (Comparison Bot):** Searches flights across multiple routes/dates, extracts data, generates a comparison table (console and text file output).
3.  **L2 API Bot (`npm run l2`):** Demonstrates an L2 bot that detects a hidden `bot-api-endpoint` meta tag and queries `/bot/graphql` directly.
4.  **L2 Comparison Bot (`npm run comparison-l2`):** Combines comparison features with L2 API access, using the discovered endpoint for searches and reporting a `comparison_search` intent.

**Bot Detection Features Triggered:**
The simulations intentionally trigger bot detection mechanisms:
*   Mechanical timing and precise clicking.
*   Setting bot-specific headers.
*   Custom User-Agent strings.
*   Direct interaction with DOM elements.

**Setup:** Requires Node.js, Playwright (`npm install`, `npx playwright install chromium`). The main AI-Cessible server must be running.
**Output:** Screenshots and, for comparison bots, a comparison table.
