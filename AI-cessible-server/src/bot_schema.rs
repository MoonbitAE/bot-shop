use async_graphql::{Context, InputObject, Object, SimpleObject};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tracing::info;

use crate::schema::FlightOffer;

/// Bot-specific intent data
#[derive(InputObject, Deserialize, Debug)]
pub struct BotIntent {
    pub intent_type: String,
    pub query_params: Option<serde_json::Value>,
    pub reason: Option<String>,
    pub additional_context: Option<serde_json::Value>,
}

/// Bot intent record stored in the database
#[derive(sqlx::FromRow, Serialize)]
pub struct BotIntentRecord {
    pub id: i64,
    pub agent_type: String,
    pub confidence: f32,
    pub intent_type: String,
    pub query_params: Option<String>,
    pub reason: Option<String>,
    pub additional_context: Option<String>,
    pub recorded_time: String,
}

/// Explanation for a flight offer
#[derive(SimpleObject, Serialize)]
pub struct OfferExplanation {
    pub flight_id: i64,
    pub base_fare: f64,
    pub taxes_fees: f64,
    pub comparative_value: f64,
    pub cancellation_policy: String,
    pub seat_details: SeatDetails,
    pub structured_explanation: serde_json::Value,
}

/// Seat details for flight offers
#[derive(SimpleObject, Serialize)]
pub struct SeatDetails {
    pub pitch_inches: f32,
    pub width_inches: f32,
    pub recline_degrees: f32,
    pub has_power: bool,
    pub has_wifi: bool,
}

/// Comparative insights for flight offers
#[derive(SimpleObject, Serialize)]
pub struct OfferInsights {
    pub flight_id: i64,
    pub price_comparison: PriceComparison,
    pub convenience_score: f32,
    pub reliability_score: f32,
    pub structured_data: serde_json::Value,
}

/// Price comparison data
#[derive(SimpleObject, Serialize)]
pub struct PriceComparison {
    pub average_price: f64,
    pub percentile: f32,
    pub price_history: Vec<HistoricalPrice>,
}

/// Historical price point
#[derive(SimpleObject, Serialize)]
pub struct HistoricalPrice {
    pub date: String,
    pub price: f64,
}

/// Root Query type for Bot-specific GraphQL
pub struct BotQueryRoot;

#[Object]
impl BotQueryRoot {
    /// Search flights by origin, destination, and (optional) dates
    /// Same as the regular schema, but with structured data for bots
    #[graphql(name = "searchFlights")]
    async fn search_flights(
        &self,
        ctx: &Context<'_>,
        origin: String,
        destination: String,
        dates: Vec<String>,
    ) -> async_graphql::Result<Vec<FlightOffer>> {
        let pool = ctx.data::<SqlitePool>()?;
        
        // Log the bot search
        info!("Bot searching flights: {} to {}, dates: {:?}", origin, destination, dates);
        
        let flights = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE origin = ? AND destination = ?",
        )
        .bind(origin)
        .bind(destination)
        .fetch_all(pool)
        .await?;
        
        Ok(flights)
    }
    
    /// Request structured explanation of a flight offer
    #[graphql(name = "requestExplanation")]
    async fn request_explanation(&self, ctx: &Context<'_>, flight_id: i64) -> async_graphql::Result<OfferExplanation> {
        let pool = ctx.data::<SqlitePool>()?;
        
        // Fetch the flight data
        let flight = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE id = ?",
        )
        .bind(flight_id)
        .fetch_one(pool)
        .await?;
        
        // Log the explanation request
        info!("Bot requested explanation for flight {}", flight_id);
        
        // In a real implementation, this would generate dynamic explanations
        // For now, return static data
        let explanation = OfferExplanation {
            flight_id: flight.id,
            base_fare: flight.price * 0.85,
            taxes_fees: flight.price * 0.15,
            comparative_value: 0.78,
            cancellation_policy: "Cancellable with 70% refund up to 24 hours before departure".to_string(),
            seat_details: SeatDetails {
                pitch_inches: 32.0,
                width_inches: 18.5,
                recline_degrees: 5.0,
                has_power: true,
                has_wifi: flight.price > 200.0,
            },
            structured_explanation: serde_json::json!({
                "fare_class": "Economy",
                "baggage_allowance": {
                    "carry_on": 1,
                    "checked": 1,
                    "weight_limit_kg": 23
                },
                "meal_service": flight.price > 200.0,
                "loyalty_points": (flight.price as i32) / 10,
                "change_fee": (flight.price * 0.1) as i32
            }),
        };
        
        Ok(explanation)
    }
    
    /// Get comparative insights for a flight offer
    #[graphql(name = "offerInsights")]
    async fn offer_insights(&self, ctx: &Context<'_>, flight_id: i64) -> async_graphql::Result<OfferInsights> {
        let pool = ctx.data::<SqlitePool>()?;
        
        // Fetch the flight data
        let flight = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE id = ?",
        )
        .bind(flight_id)
        .fetch_one(pool)
        .await?;
        
        // Log the insights request
        info!("Bot requested insights for flight {}", flight_id);
        
        // Generate mock historical prices
        let mut price_history = Vec::new();
        let base_price = flight.price;
        
        // Create 5 historical price points
        for i in 1..=5 {
            let variance = 0.95 + (i as f64 * 0.02);
            price_history.push(HistoricalPrice {
                date: format!("2024-{:02}-01", i + 1),
                price: base_price * variance,
            });
        }
        
        // In a real implementation, this would generate dynamic insights
        let insights = OfferInsights {
            flight_id: flight.id,
            price_comparison: PriceComparison {
                average_price: base_price * 1.05,
                percentile: 35.0, // Lower percentile = better deal
                price_history,
            },
            convenience_score: 0.75,
            reliability_score: 0.88,
            structured_data: serde_json::json!({
                "delay_probability": 0.12,
                "cancellation_risk": 0.03,
                "airport_transfer_time": {
                    "origin": 25,
                    "destination": 30
                },
                "alternative_flights": [
                    {
                        "id": flight.id + 1,
                        "price_difference": "+$35",
                        "time_difference": "-45min"
                    },
                    {
                        "id": flight.id - 1,
                        "price_difference": "-$20",
                        "time_difference": "+90min"
                    }
                ]
            }),
        };
        
        Ok(insights)
    }
    
    /// Get a booking with structured data for bots
    #[graphql(name = "getStructuredBooking")]
    async fn get_structured_booking(&self, ctx: &Context<'_>, id: i64) -> async_graphql::Result<serde_json::Value> {
        let pool = ctx.data::<SqlitePool>()?;
        
        // Fetch the booking using the existing query
        let (booking_id, flight_id, passenger_details, payment_details, booking_time): (i64, i64, String, String, String) =
            sqlx::query_as(
                "SELECT id, flight_id, passenger_details, payment_details, booking_time FROM bookings WHERE id = ?",
            )
            .bind(id)
            .fetch_one(pool)
            .await?;
            
        let flight = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE id = ?",
        )
        .bind(flight_id)
        .fetch_one(pool)
        .await?;
        
        // Return structured JSON for easier bot consumption
        let structured_booking = serde_json::json!({
            "booking": {
                "id": booking_id,
                "created_at": booking_time,
                "passenger": passenger_details,
                // Mask payment details for security
                "payment_last4": payment_details.chars().rev().take(4).collect::<String>().chars().rev().collect::<String>(),
            },
            "flight": {
                "id": flight.id,
                "route": {
                    "origin": {
                        "code": flight.origin,
                        "departure_time": flight.departure_time
                    },
                    "destination": {
                        "code": flight.destination,
                        "arrival_time": flight.arrival_time
                    }
                },
                "price": {
                    "total": flight.price,
                    "currency": "USD"
                }
            },
            "machine_readable": {
                "duration_minutes": 180, // Mock value
                "miles": 1250, // Mock value
                "carbon_offset_available": true
            }
        });
        
        Ok(structured_booking)
    }
}

/// Root Mutation type for Bot-specific GraphQL
pub struct BotMutationRoot;

#[Object]
impl BotMutationRoot {
    /// Submit user intent data (search, booking, abandonment)
    #[graphql(name = "submitIntent")]
    async fn submit_intent(&self, _ctx: &Context<'_>, intent: BotIntent) -> async_graphql::Result<bool> {
        // Log the intent data
        info!("Bot intent received: {:?}", intent);
        
        // In a production system, store in database
        // For this demo, we just log it
        
        Ok(true)
    }
    
    /// Submit behavior metrics from client-side tracking
    #[graphql(name = "submitBehaviorMetrics")]
    async fn submit_behavior_metrics(&self, _ctx: &Context<'_>, metrics: serde_json::Value) -> async_graphql::Result<bool> {
        // Log the metrics data
        info!("Bot behavior metrics: {}", metrics);
        
        // In a real implementation, this would be stored in a database
        // For this demo, just log it
        
        Ok(true)
    }
    
    /// Book a flight with passenger and payment details - bot optimized version
    #[graphql(name = "bookFlight")]
    async fn book_flight(
        &self,
        ctx: &Context<'_>,
        passenger_details: String,
        payment: String,
        flight_id: f64, // Note: Match the type from the frontend (Float)
    ) -> async_graphql::Result<crate::schema::BookingConfirmation> {
        let pool = ctx.data::<SqlitePool>()?;
        
        // Log the bot booking
        info!("Bot booking flight: id={}, passenger={}", flight_id, passenger_details);
        
        let flight_id = flight_id as i64; // Convert to i64 for SQLite
        
        let mut tx = pool.begin().await?;
        let result = sqlx::query(
            "INSERT INTO bookings (flight_id, passenger_details, payment_details, booking_time) VALUES (?, ?, ?, datetime('now'))",
        )
        .bind(flight_id)
        .bind(&passenger_details)
        .bind(&payment)
        .execute(&mut tx)
        .await?;
        
        let booking_id = result.last_insert_rowid();
        tx.commit().await?;
        
        let flight = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE id = ?",
        )
        .bind(flight_id)
        .fetch_one(pool)
        .await?;
        
        Ok(crate::schema::BookingConfirmation { booking_id, flight })
    }
    
    /// Simulate a negotiation with the booking system
    #[graphql(name = "negotiateOffer")]
    async fn negotiate_offer(
        &self, 
        ctx: &Context<'_>, 
        flight_id: i64,
        negotiation_context: serde_json::Value
    ) -> async_graphql::Result<serde_json::Value> {
        let pool = ctx.data::<SqlitePool>()?;
        
        // Fetch the flight data
        let flight = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE id = ?",
        )
        .bind(flight_id)
        .fetch_one(pool)
        .await?;
        
        // Log the negotiation attempt
        info!(
            "Bot negotiation attempt for flight {}: {}",
            flight_id, negotiation_context
        );
        
        // Parse negotiation parameters (simplified)
        let negotiation_type = if let Some(n_type) = negotiation_context.get("type") {
            n_type.as_str().unwrap_or("discount")
        } else {
            "discount"
        };
        
        // Prepare response based on negotiation type
        let response = match negotiation_type {
            "discount" => {
                // Offer small discount
                serde_json::json!({
                    "success": true,
                    "original_price": flight.price,
                    "negotiated_price": (flight.price * 0.95).round(),
                    "discount_percent": 5,
                    "discount_reason": "Loyalty member pricing",
                    "expiration": "30 minutes"
                })
            },
            "upgrade" => {
                // Offer seat upgrade
                serde_json::json!({
                    "success": true,
                    "original_seat": "Economy",
                    "upgraded_seat": "Economy Plus",
                    "upgrade_fee": (flight.price * 0.15).round(),
                    "benefits": ["More legroom", "Priority boarding", "Free drink"],
                    "expiration": "30 minutes"
                })
            },
            _ => {
                // No negotiation available
                serde_json::json!({
                    "success": false,
                    "reason": "No negotiation available for this request type",
                    "alternative_offers": []
                })
            }
        };
        
        Ok(response)
    }
} 