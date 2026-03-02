use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::{Friendship, User},
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
        .route("/", get(get_friends))
        .route("/request", post(send_request))
        .route("/:id/accept", post(accept_request))
        .route("/:id/reject", post(reject_request))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

async fn get_friends(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Friendship>>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let coll = state.db.collection::<Friendship>("friendships");

    let filter = doc! {
        "$or": [
            { "requesterId": user_id },
            { "recipientId": user_id }
        ]
    };

    let mut cursor = coll
        .find(filter)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut friends = Vec::new();
    while let Some(item) = cursor.try_next().await.unwrap_or(None) {
        friends.push(item);
    }

    Ok(Json(friends))
}

#[derive(Deserialize)]
pub struct FriendRequestPayload {
    pub username: String,
}

async fn send_request(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<FriendRequestPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let users_coll = state.db.collection::<User>("users");
    let friends_coll = state.db.collection::<Friendship>("friendships");

    let recipient = users_coll
        .find_one(doc! { "username": &payload.username })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let recipient_id = recipient.id.unwrap();

    if user_id == recipient_id {
        return Err((StatusCode::BAD_REQUEST, "Cannot add yourself".to_string()));
    }

    let existing = friends_coll
        .find_one(doc! {
            "$or": [
                { "requesterId": user_id, "recipientId": recipient_id },
                { "requesterId": recipient_id, "recipientId": user_id }
            ]
        })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Friendship or request already exists".to_string(),
        ));
    }

    let new_friendship = Friendship {
        id: None,
        requester_id: user_id,
        recipient_id,
        status: "PENDING".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    friends_coll
        .insert_one(new_friendship)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        serde_json::json!({ "success": true, "message": "Friend request sent" }),
    ))
}

async fn accept_request(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let friendship_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let coll = state.db.collection::<Friendship>("friendships");

    let result = coll
        .update_one(
            doc! { "_id": friendship_id, "recipientId": user_id, "status": "PENDING" },
            doc! { "$set": { "status": "ACCEPTED", "updatedAt": Utc::now().to_rfc3339() } },
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.modified_count == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Friend request not found or not pending".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn reject_request(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let friendship_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let coll = state.db.collection::<Friendship>("friendships");

    let result = coll
        .update_one(
            doc! { "_id": friendship_id, "recipientId": user_id, "status": "PENDING" },
            doc! { "$set": { "status": "REJECTED", "updatedAt": Utc::now().to_rfc3339() } },
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.modified_count == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Friend request not found or not pending".into(),
        ));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}
