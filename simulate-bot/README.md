# AI-cessible Bot Simulation

This directory contains Playwright-based scripts to simulate bot behavior interacting with the AI-cessible Airline Shopping demo.

## What's Included

- `bot.js` - Simple bot simulation that walks through the complete flight booking process
- `comparison-bot.js` - Advanced bot that performs comparative shopping across multiple dates and routes

## Setup

The simulation requires Node.js and Playwright. Installation:

```bash
# Install dependencies
npm install

# Install Chromium browser for Playwright
npx playwright install chromium
```

## Running the Simulations

Make sure that the AI-cessible server is running on http://localhost:8000 before starting the bot simulations.

### Basic Bot

```bash
npm run bot
```

This will:
- Launch a browser
- Fill in the flight search form
- Select the first available flight
- Complete a booking
- Take screenshots at each step

### Comparison Bot

```bash
npm run comparison
```

This more advanced bot will:
- Search for flights across multiple routes and dates
- Extract pricing and flight information
- Generate a comparison table
- Output results to the console and a text file

## Bot Detection Features

The simulations include bot detection triggers such as:
- Mechanical timing and precise clicking
- Setting bot-specific headers
- Custom User-Agent strings
- Direct interaction with DOM elements

## Output

Each simulation will produce screenshots showing the bot's progress and a final comparison table (for the comparison bot).

Screenshots will be saved in the same directory as the script. 