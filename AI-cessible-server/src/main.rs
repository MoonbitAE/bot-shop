use axum::{Router, routing::post, Extension};
use async_graphql::{Schema, EmptySubscription};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use std::net::SocketAddr;
use tower_http::services::ServeDir;

mod schema;
use schema::{QueryRoot, MutationRoot};

type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

async fn graphql_handler(schema: Extension<AppSchema>, req: GraphQLRequest) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

#[tokio::main]
async fn main() {
    let schema = Schema::build(QueryRoot::default(), MutationRoot::default(), EmptySubscription)
        .finish();

    let app = Router::new()
        .route("/graphql", post(graphql_handler))
        .route("/bot/graphql", post(graphql_handler))
        .nest_service("/", ServeDir::new("static"))
        .layer(Extension(schema));

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    println!("Server running at http://{}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
