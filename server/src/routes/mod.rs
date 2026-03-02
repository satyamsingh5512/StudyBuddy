pub mod auth;
pub mod todos;
pub mod users;
pub mod schedule;
pub mod timer;
pub mod faqs;
pub mod notices;
pub mod friends;
pub mod messages;
pub mod username;
pub mod waitlist;
pub mod reports;
pub mod admin;
pub mod upload;
pub mod news;

use axum::Router;
use std::sync::Arc;
use crate::AppState;

pub fn create_router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .nest("/api/auth", auth::router(state.clone()))
        .nest("/api/todos", todos::router(state.clone()))
        .nest("/api/users", users::router(state.clone()))
        .nest("/api/schedule", schedule::router(state.clone()))
        .nest("/api/timer", timer::router(state.clone()))
        .nest("/api/faqs", faqs::router())
        .nest("/api/notices", notices::router())
        .nest("/api/friends", friends::router(state.clone()))
        .nest("/api/messages", messages::router(state.clone()))
        .nest("/api/username", username::router(state.clone()))
        .nest("/api/waitlist", waitlist::router())
        .nest("/api/reports", reports::router(state.clone()))
        .nest("/api/admin", admin::router(state.clone()))
        .nest("/api/upload", upload::router(state.clone()))
        .nest("/api/news", news::router(state.clone()))
}
