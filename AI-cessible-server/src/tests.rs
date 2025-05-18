#[cfg(test)]
mod tests {
    use super::schema::{QueryRoot, MutationRoot, FlightOffer};
    use super::bot_schema::{BotQueryRoot, BotMutationRoot};
    use super::bot_detection::BotInfo;
    use async_graphql::{Schema, Request};
    use sqlx::SqlitePool;

    type AppSchema = Schema<QueryRoot, MutationRoot, async_graphql::EmptySubscription>;
    type BotSchema = Schema<BotQueryRoot, BotMutationRoot, async_graphql::EmptySubscription>;

    async fn setup_schema() -> (SqlitePool, AppSchema, BotSchema) {
        let database_url = "sqlite::memory:";
        let pool = SqlitePool::connect(database_url).await.unwrap();
        sqlx::query(
            r#"CREATE TABLE flights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                departure_time TEXT NOT NULL,
                arrival_time TEXT NOT NULL,
                price REAL NOT NULL
            );"#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"INSERT INTO flights (origin, destination, departure_time, arrival_time, price)
               VALUES ('NYC','LAX','2025-06-01T08:00:00','2025-06-01T11:00:00',199.0);"#,
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            r#"CREATE TABLE bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flight_id INTEGER NOT NULL,
                passenger_details TEXT NOT NULL,
                payment_details TEXT NOT NULL,
                booking_time TEXT NOT NULL
            );"#,
        )
        .execute(&pool)
        .await
        .unwrap();

        let schema = Schema::build(QueryRoot, MutationRoot, async_graphql::EmptySubscription)
            .data(pool.clone())
            .finish();
        let bot_schema = Schema::build(BotQueryRoot, BotMutationRoot, async_graphql::EmptySubscription)
            .data(pool.clone())
            .finish();
        (pool, schema, bot_schema)
    }

    #[tokio::test]
    async fn test_search_flights() {
        let (_pool, schema, _bot) = setup_schema().await;
        let request = Request::new("{ searchFlights(origin: \"NYC\", destination: \"LAX\", dates: []) { id } }");
        let response = schema.execute(request).await.data;
        let list = response.into_json().unwrap()["searchFlights"].as_array().unwrap().clone();
        assert!(!list.is_empty());
    }

    #[tokio::test]
    async fn test_bot_info() {
        let info = BotInfo { confidence_score: 0.6, agent_type: "bot".to_string(), request_start: std::time::Instant::now() };
        assert!(info.is_likely_bot());
    }

    #[tokio::test]
    async fn test_build_offer_mutation() {
        let (_pool, schema, _bot) = setup_schema().await;
        let query = "mutation { buildOffer(flightId: 1, addons: []) { totalPrice } }";
        let request = Request::new(query);
        let response = schema.execute(request).await.data;
        let price = response.into_json().unwrap()["buildOffer"]["totalPrice"].as_f64().unwrap();
        assert!(price > 0.0);
    }
}
