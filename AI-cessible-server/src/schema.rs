use async_graphql::{Object, SimpleObject};

#[derive(SimpleObject, Clone)]
pub struct Flight {
    pub id: i32,
    pub origin: String,
    pub destination: String,
    pub departure_time: String,
    pub arrival_time: String,
    pub price: f64,
}

#[derive(Default)]
pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn search_flights(&self, origin: String, destination: String, dates: Vec<String>) -> Vec<Flight> {
        let date = dates.get(0).cloned().unwrap_or_else(|| "2025-06-01".to_string());
        vec![Flight {
            id: 1,
            origin,
            destination,
            departure_time: format!("{}T09:00:00Z", date),
            arrival_time: format!("{}T12:00:00Z", date),
            price: 199.0,
        }]
    }
}

#[derive(Default)]
pub struct MutationRoot;

#[Object]
impl MutationRoot {
    async fn book_flight(&self, passenger_details: String, payment: String, flight_id: i32) -> Flight {
        Flight {
            id: flight_id,
            origin: passenger_details,
            destination: payment,
            departure_time: "2025-06-01T09:00:00Z".into(),
            arrival_time: "2025-06-01T12:00:00Z".into(),
            price: 199.0,
        }
    }
}
