# Project Brief: AI-Cessible Airline Shopping Demo

## Objective

Demonstrate a next-generation airline e-commerce platform designed to **optimize the experience for AI shopping bots**, while still supporting traditional human users. This includes a **Rust-based Axum backend with GraphQL**, a **ReactJS frontend**, and a set of **AI-friendly (AI-cessible) service endpoints** to simulate how future commerce sites might better support bot-augmented buyers.

## Key Components

### Frontend
- Built using **ReactJS**.
- Pages:
  - **Flight Search Page**
  - **Flight Results Page**
  - **Passenger Information Page**
  - **Payment Page**
  - **Confirmation Page**
- All pages fetch data and submit state via **GraphQL queries/mutations**.
- Bot-aware interfaces conditionally rendered (e.g., `explain-this-offer`, intent submission).

### Backend
- Built in **Rust** using:
  - [`Axum`](https://docs.rs/axum/latest/axum/)
  - [`async-graphql`](https://docs.rs/async-graphql/)
  - [`tower`](https://docs.rs/tower/) for middleware
  - [`tracing`](https://docs.rs/tracing/) for diagnostics
- Core GraphQL APIs:
  - `searchFlights(origin, destination, dates): [FlightOffer]`
  - `buildOffer(flightId, addons): OfferSummary`
  - `bookFlight(passengerDetails, payment): BookingConfirmation`
  - `getBooking(id): BookingDetail`

### AI-Cessible (Bot-Specific) APIs
Isolated via path prefix `/bot/graphql` and IP/user-agent based routing:
- `bot/intent`: POST to record bot intent, GET to retrieve saved intents.
- `bot/requestExplanation`: returns structured JSON explanations of offers.
- `bot/offerInsights`: returns comparative reasoning metadata (e.g., seat pitch, cancellation risk).
- `bot/negotiation`: optional endpoint to simulate future incentive logic.
- `bot/behaviorMetrics`: exposes time-to-decision, retries, and other analytics.

These endpoints return **structured, compressed JSON responses**, meant for rapid bot consumption, not rendering.

---

## AI-Cessibility Principles

Inspired by accessibility standards for disabled users, **AI-cessibility** is the concept of designing web and API experiences that:
- Provide **structured, interpretable content** for bots (not scraped content).
- Include **intent tagging and outcome feedback** for bot learning.
- Enable **transparent offer reasoning**, like fare breakdowns and add-on justifications.
- Offer **negotiation, incentive, and personalization hooks** for future use.

---

## Bot Detection Techniques

Implemented via middleware and GraphQL extensions:
- **Navigation Pattern Detection**:
  - Bots often traverse pages with no scroll, mouse movement, or viewport resizing.
  - Use timing, entropy of clicks, and DOM interaction tracking (via JS client) to feed bot signal score.
- **Behavioral Fingerprinting**:
  - JS-injected micro-interactions (e.g., hover delay, form fill time).
- **User-Agent & Header Inspection**:
  - Known bot user-agents, header anomalies, and TLS fingerprinting.
- **GraphQL Complexity Tracking**:
  - Monitor field-resolution patterns typical of scripted bots.

Output: Bot-Confidence Score → Used to route to bot/human API variants.

### Bot Intelligence Classification

The client derives an intelligence level from the bot score, navigation patterns,
and use of bot-only endpoints (`/bot/submitIntent`, `/bot/requestExplanation`, etc.).

- **L0** – low score and no bot API usage.
- **L1** – moderate score or minimal bot API calls.
- **L2** – high score with repeated bot endpoint usage.

---

## Development Phases

### Phase 1: Core Flight Shopping MVP
- GraphQL backend services
- React frontend wired to core services
- Basic bot and human flows

### Phase 2: AI-Cessible Bot Enhancements
- Isolated bot endpoints
- Intent capture + abandonment feedback
- Offer explanation API

### Phase 3: Bot Detection & Adaptive Delivery
- Real-time detection middleware
- Dual API logic routing
- Custom frontend elements for bot/human divergence

---

## Use Cases to Demonstrate

- Bot builds dynamic comparison table across 10 dates + 3 class types
- Bot provides reason for abandoning one itinerary (e.g., layover too long)
- Human user receives interactive tooltip, bot gets `/requestExplanation`
- Differentiated loyalty incentives shown for bot vs. human

---

## Diagram (Mermaid)

```mermaid
graph TD
  A[React Frontend] -->|GraphQL| B[Axum GraphQL Gateway]
  B --> C[Flight Search Engine]
  B --> D[Offer Construction Service]
  B --> E[Booking Processor]
  B --> F[Bot Behavior Logger]
  B --> G[Bot Explanation Service]
  H[JS Bot Detection Module] --> B
  B -->|Route by Bot Score| I[Human APIs]
  B -->|Route by Bot Score| J[Bot APIs]

Success Criteria
	•	Bot completes end-to-end booking via GraphQL API
	•	User experience is unimpacted by bot enhancements
	•	Logged bot behavior can be visualized and analyzed
	•	Explanations and structured reasoning API prove beneficial in comparison use cases

⸻

Future Enhancements
	•	Integrate Large Language Model inference on backend to auto-generate offer insights.
	•	Include partner SDK for third-party bot integration testing.
	•	Add counterfactual analytics for bots: “What if X was changed?”
