use async_graphql::{Context, EmptySubscription, Object, SimpleObject};
use sqlx::SqlitePool;

/// Flight offer returned by the searchFlights query
#[derive(sqlx::FromRow, SimpleObject, Clone)]
pub struct FlightOffer {
    pub id: i64,
    pub origin: String,
    pub destination: String,
    pub departure_time: String,
    pub arrival_time: String,
    pub price: f64,
}

/// Summary of a flight offer, including selected add-ons
#[derive(SimpleObject)]
pub struct OfferSummary {
    pub flight: FlightOffer,
    pub addons: Vec<String>,
    pub total_price: f64,
}

/// Confirmation data for a booked flight
#[derive(SimpleObject)]
pub struct BookingConfirmation {
    pub booking_id: i64,
    pub flight: FlightOffer,
}

/// Detailed booking information
#[derive(SimpleObject)]
pub struct BookingDetail {
    pub booking_id: i64,
    pub flight: FlightOffer,
    pub passenger_details: String,
    pub payment_details: String,
    pub booking_time: String,
}

/// Root Query type for GraphQL
pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// Search flights by origin, destination, and (optional) dates
    #[graphql(name = "searchFlights")]
    async fn search_flights(
        &self,
        ctx: &Context<'_>,
        origin: String,
        destination: String,
        dates: Vec<String>,
    ) -> async_graphql::Result<Vec<FlightOffer>> {
        let pool = ctx.data::<SqlitePool>()?;
        let flights = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE origin = ? AND destination = ?",
        )
        .bind(origin)
        .bind(destination)
        .fetch_all(pool)
        .await?;
        Ok(flights)
    }

    /// Retrieve a booking by its ID
    #[graphql(name = "getBooking")]
    async fn get_booking(&self, ctx: &Context<'_>, id: i64) -> async_graphql::Result<BookingDetail> {
        let pool = ctx.data::<SqlitePool>()?;
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
        Ok(BookingDetail {
            booking_id,
            flight,
            passenger_details,
            payment_details,
            booking_time,
        })
    }
}

/// Root Mutation type for GraphQL
pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Build an offer summary for a given flight and selected add-ons
    #[graphql(name = "buildOffer")]
    async fn build_offer(
        &self,
        ctx: &Context<'_>,
        flight_id: i64,
        addons: Vec<String>,
    ) -> async_graphql::Result<OfferSummary> {
        let pool = ctx.data::<SqlitePool>()?;
        let flight = sqlx::query_as::<_, FlightOffer>(
            "SELECT id, origin, destination, departure_time, arrival_time, price FROM flights WHERE id = ?",
        )
        .bind(flight_id)
        .fetch_one(pool)
        .await?;
        let mut total = flight.price;
        for _ in &addons {
            total += 10.0;
        }
        Ok(OfferSummary { flight, addons, total_price: total })
    }

    /// Book a flight with passenger and payment details
    #[graphql(name = "bookFlight")]
    async fn book_flight(
        &self,
        ctx: &Context<'_>,
        passenger_details: String,
        payment: String,
        flight_id: i64,
    ) -> async_graphql::Result<BookingConfirmation> {
        let pool = ctx.data::<SqlitePool>()?;
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
        Ok(BookingConfirmation { booking_id, flight })
    }
}