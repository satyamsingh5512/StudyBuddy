use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::DirectMessage,
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::Utc;
use futures::stream::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;
use std::{str::FromStr, sync::Arc};

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/:userId", get(get_messages))
        .route("/", post(send_message))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

async fn get_messages(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(other_user_id): Path<String>,
) -> Result<Json<Vec<DirectMessage>>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let other_id = ObjectId::from_str(&other_user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let coll = state.db.collection::<DirectMessage>("direct_messages");

    let filter = doc! {
        "$or": [
            { "senderId": user_id, "receiverId": other_id },
            { "senderId": other_id, "receiverId": user_id }
        ]
    };

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .build();

    let mut cursor = coll
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut messages = Vec::new();
    while let Some(item) = cursor.try_next().await.unwrap_or(None) {
        messages.push(item);
    }

    // Mark as read
    coll.update_many(
        doc! { "senderId": other_id, "receiverId": user_id, "read": false },
        doc! { "$set": { "read": true } },
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(messages))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessagePayload {
    pub receiver_id: String,
    pub content: Option<String>,
    pub file_url: Option<String>,
}

async fn send_message(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<SendMessagePayload>,
) -> Result<Json<DirectMessage>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let receiver_id = ObjectId::from_str(&payload.receiver_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid receiver ID".into()))?;

    let coll = state.db.collection::<DirectMessage>("direct_messages");

    let now = Utc::now();
    let new_msg = DirectMessage {
        id: None,
        sender_id: user_id,
        receiver_id,
        content: payload.content.clone(),
        message: payload.content, // legacy
        file_url: payload.file_url,
        read: false,
        created_at: now,
        updated_at: Some(now),
    };

    let result = coll
        .insert_one(new_msg.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut inserted = new_msg;
    inserted.id = result.inserted_id.as_object_id();

    Ok(Json(inserted))
}
