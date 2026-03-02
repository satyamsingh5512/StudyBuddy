use crate::{
    middleware::{
        admin::is_admin,
        auth::{is_authenticated, AuthUser},
    },
    models::User,
    AppState,
};
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use futures::stream::TryStreamExt;
use mongodb::bson::doc;
use serde::Serialize;
use std::sync::Arc;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/stats", get(get_stats))
        .route("/send-daily-stats", post(send_daily_stats))
        // Apply both middlewares: first auth, then admin
        .route_layer(axum::middleware::from_fn(is_admin))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminStatsResponse {
    pub total_users: u64,
    pub verified_users: u64,
    pub active_today: u64,
    pub temp_email_users: u64,
    pub timestamp: chrono::DateTime<Utc>,
}

async fn get_stats(
    State(state): State<Arc<AppState>>,
    Extension(_auth_user): Extension<AuthUser>,
) -> Result<Json<AdminStatsResponse>, (StatusCode, String)> {
    let users_coll = state.db.collection::<User>("users");

    let total_users = users_coll.count_documents(doc! {}).await.unwrap_or(0);
    let verified_users = users_coll
        .count_documents(doc! { "emailVerified": true })
        .await
        .unwrap_or(0);

    let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let today_utc = DateTime::<Utc>::from_naive_utc_and_offset(today, Utc);

    let active_today = users_coll
        .count_documents(doc! { "lastActive": { "$gte": today_utc.to_rfc3339() } })
        .await
        .unwrap_or(0);

    let mut cursor = users_coll
        .find(doc! {})
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut temp_email_users = 0;
    // Simple naive check for temp emails since we don't have the full validator here
    let temp_domains = ["tempmail", "10minutemail", "guerrillamail"];

    while let Some(user) = cursor.try_next().await.unwrap_or(None) {
        let domain = user.email.split('@').next_back().unwrap_or("");
        if temp_domains.iter().any(|&d| domain.contains(d)) {
            temp_email_users += 1;
        }
    }

    Ok(Json(AdminStatsResponse {
        total_users,
        verified_users,
        active_today,
        temp_email_users,
        timestamp: Utc::now(),
    }))
}

async fn send_daily_stats(
    Extension(_auth_user): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Note: Email sending logic has been simplified for the rewrite.
    // To implement fully, integrate an email provider crate like 'lettre' or use reqwest with Resend/SendGrid.
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Daily stats emails processed (mocked)",
        "successCount": 0,
        "failCount": 0,
        "skippedTempEmails": 0,
        "totalUsers": 0
    })))
}
