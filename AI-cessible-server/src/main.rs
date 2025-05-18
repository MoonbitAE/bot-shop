use std::net::SocketAddr;
// Use axum's serve utility with a Tokio TCP listener
use tokio::net::TcpListener;
use axum::serve;
use axum::{
    extract::Extension,
    http::StatusCode,
    response::{IntoResponse, Html, Json},
    routing::{get, post, get_service},
    Router,
    middleware,
};
use async_graphql::{EmptySubscription, Schema};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use sqlx::SqlitePool;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing_subscriber;
use tracing::{info, debug};
use std::sync::Arc;

mod schema;
mod bot_schema;
mod bot_detection;

use schema::{MutationRoot, QueryRoot};
use bot_schema::{BotQueryRoot, BotMutationRoot};
use bot_detection::{bot_detection_middleware, BotInfo};

/// Combined GraphQL schema type for regular users
type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

/// Bot-specific GraphQL schema type
type BotSchema = Schema<BotQueryRoot, BotMutationRoot, EmptySubscription>;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing for request logging
    tracing_subscriber::fmt::init();

    // Ensure a writable temp directory for SQLite operations (e.g., journaling)
    let tmp_dir = "./tmp";
    std::fs::create_dir_all(tmp_dir)?;
    // SAFETY: setting environment variable is thread-safe at this point
    unsafe { std::env::set_var("SQLITE_TMPDIR", tmp_dir); }

    // Initialize SQLite connection pool
    // Use SQLite file in current directory
    // Use in-memory SQLite database for demo (no file permissions issues)
    let database_url = "sqlite::memory:";
    let pool = SqlitePool::connect(database_url).await?;

    // Create tables if they do not exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS flights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            departure_time TEXT NOT NULL,
            arrival_time TEXT NOT NULL,
            price REAL NOT NULL
        );
        "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_id INTEGER NOT NULL,
            passenger_details TEXT NOT NULL,
            payment_details TEXT NOT NULL,
            booking_time TEXT NOT NULL
        );
        "#,
    )
    .execute(&pool)
    .await?;

    // Seed flight data if empty
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM flights")
        .fetch_one(&pool)
        .await?;
    if count.0 == 0 {
        let sample_flights = vec![
            ("NYC", "LAX", "2025-06-01T08:00:00", "2025-06-01T11:00:00", 199.0),
            ("NYC", "SFO", "2025-06-02T09:00:00", "2025-06-02T12:30:00", 249.0),
            ("LAX", "SEA", "2025-06-03T07:00:00", "2025-06-03T09:45:00", 149.0),
        ];
        for (origin, destination, dep, arr, price) in sample_flights {
            sqlx::query(
                "INSERT INTO flights (origin, destination, departure_time, arrival_time, price) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(origin)
            .bind(destination)
            .bind(dep)
            .bind(arr)
            .bind(price)
            .execute(&pool)
            .await?;
        }
    }

    // Build GraphQL schema for human users
    let schema = Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(pool.clone())
        .finish();

    // Build GraphQL schema for bots
    let bot_schema = Schema::build(BotQueryRoot, BotMutationRoot, EmptySubscription)
        .data(pool.clone())
        .finish();

    // Paths for React static files
    let static_dir = ServeDir::new("./static").append_index_html_on_directories(true);
    let index_file = ServeFile::new("./static/index.html");

    // Build Axum application with routes and static file fallback
    let app = Router::new()
        // First define all routes
        // Regular GraphQL endpoint
        .route("/graphql", get(graphql_playground).post(graphql_handler))
        // Bot-specific GraphQL endpoint
        .route("/bot/graphql", post(bot_graphql_handler))
        // Behavior metrics endpoint for client-side tracking
        .route("/bot/behaviorMetrics", post(behavior_metrics_handler))
        // Serve the React app entrypoint
        .route("/", get_service(index_file))
        // Serve static files using proper nesting
        .nest_service("/static", ServeDir::new("./static/static"))
        // Then apply middleware to all routes
        .route_layer(middleware::from_fn(bot_detection_middleware))
        // Add schema data to all routes
        .layer(Extension(schema))
        .layer(Extension(bot_schema))
        // Add tracing layer
        .layer(TraceLayer::new_for_http());

    // Start the server
    // Listen on localhost to satisfy sandbox permissions
    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("Server running at http://{}", addr);
    // Bind the TCP listener and serve our application
    let listener = TcpListener::bind(addr).await?;
    serve(listener, app).await?;

    Ok(())
}

/// Handler for standard GraphQL queries and mutations
async fn graphql_handler(
    Extension(schema): Extension<AppSchema>,
    bot_info: Option<Extension<BotInfo>>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    // Create a request with BotInfo data if available
    let mut request = req.into_inner();
    
    if let Some(Extension(info)) = bot_info {
        // Log the detection info
        debug!(
            "Using regular GraphQL handler: confidence={}, agent={}",
            info.confidence_score, info.agent_type
        );
        
        // Clone info before moving it
        let info_clone = info.clone();
        request = request.data(info_clone);
    }
    
    schema.execute(request).await.into()
}

/// Handler for bot-specific GraphQL queries and mutations
async fn bot_graphql_handler(
    Extension(bot_schema): Extension<BotSchema>,
    bot_info: Option<Extension<BotInfo>>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    // Create a request with BotInfo data if available
    let mut request = req.into_inner();
    
    if let Some(Extension(info)) = bot_info {
        // Clone the info for logging
        let agent_type = info.agent_type.clone();
        let confidence = info.confidence_score;
        let query = request.query.clone();
        let is_bot = info.is_likely_bot();
        
        // Add the bot info to the request context (clone it before moving)
        let info_clone = info.clone();
        request = request.data(info_clone);
        
        // Log bot API usage
        info!(
            "Bot API request: agent={}, confidence={}, is_bot={}, query={}",
            agent_type,
            confidence,
            is_bot,
            query
        );
    } else {
        // Log unknown requester
        info!("Bot API request from unknown client");
    }
    
    bot_schema.execute(request).await.into()
}

/// Handler for client-side behavior metrics
async fn behavior_metrics_handler(
    bot_info: Option<Extension<BotInfo>>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Log the received metrics
    if let Some(Extension(info)) = bot_info {
        let agent_type = info.agent_type.clone();
        let confidence = info.confidence_score;
        
        debug!(
            "Received metrics from client: agent={}, confidence={}, metrics={}",
            agent_type,
            confidence,
            payload
        );
    } else {
        debug!("Received metrics from unknown client: {}", payload);
    }
    
    // Simply acknowledge receipt
    StatusCode::OK
}

/// GraphQL playground endpoint for human users
async fn graphql_playground() -> impl IntoResponse {
    Html(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

