use crate::{models::Waitlist, AppState};
use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use chrono::Utc;
use mongodb::bson::doc;
use serde::Deserialize;
use std::sync::Arc;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", post(join_waitlist))
}

#[derive(Deserialize)]
pub struct WaitlistPayload {
    pub email: String,
}

async fn join_waitlist(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<WaitlistPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let coll = state.db.collection::<Waitlist>("waitlist");
    let email = payload.email.to_lowercase();

    let existing = coll
        .find_one(doc! { "email": &email })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Ok(Json(
            serde_json::json!({ "success": true, "message": "Already on waitlist" }),
        ));
    }

    let entry = Waitlist {
        id: None,
        email,
        created_at: Utc::now(),
    };

    coll.insert_one(entry)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}
