use axum::{
    http::{HeaderValue, Method},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use dotenvy::dotenv;
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::signal;
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowHeaders, AllowMethods, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod db;
mod middleware;
mod models;
mod utils;
// mod error;
mod routes;

#[derive(Clone)]
pub struct AppState {
    pub db: mongodb::Database,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file if it exists
    dotenv().ok();

    // Initialize tracing (logging)
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting server...");

    // Connect to MongoDB
    let db_client = db::connect().await?;
    let app_state = AppState { db: db_client };

    // Configure CORS — must use explicit origins (not Any) when credentials: 'include' is used
    let allowed_origins_raw = std::env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "https://sbd.satym.in".to_string());
    
    let allowed_origins: Vec<HeaderValue> = allowed_origins_raw
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(AllowHeaders::mirror_request())
        .allow_credentials(true);

    // Build the application router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/health", get(health_check))
        .merge(routes::create_router(Arc::new(app_state.clone())))
        // Combine middleware
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(Arc::new(app_state));

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .expect("PORT must be a number");

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn health_check() -> impl IntoResponse {
    let timestamp = chrono::Utc::now().to_rfc3339();
    Json(json!({
        "status": "ok",
        "timestamp": timestamp,
    }))
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received, starting graceful shutdown");
}
