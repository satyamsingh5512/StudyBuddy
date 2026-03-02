use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::User,
    AppState,
};
use axum::{extract::State, http::StatusCode, routing::post, Extension, Json, Router};
use mongodb::bson::doc;
use serde::Deserialize;
use std::sync::Arc;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/check", post(check_username))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

#[derive(Deserialize)]
pub struct CheckUsernamePayload {
    pub username: String,
}

async fn check_username(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CheckUsernamePayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let users_coll = state.db.collection::<User>("users");

    if payload.username.len() < 3 {
        return Ok(Json(
            serde_json::json!({ "available": false, "message": "Username too short" }),
        ));
    }

    if payload.username == auth_user.0.username {
        return Ok(Json(serde_json::json!({ "available": true })));
    }

    let existing = users_coll
        .find_one(doc! { "username": &payload.username })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        Ok(Json(
            serde_json::json!({ "available": false, "message": "Username taken" }),
        ))
    } else {
        Ok(Json(serde_json::json!({ "available": true })))
    }
}
