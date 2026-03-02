use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::Schedule,
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use futures::stream::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;
use std::{str::FromStr, sync::Arc};

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_schedules).post(create_schedule))
        .route("/:id", patch(update_schedule).delete(delete_schedule))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSchedulePayload {
    pub date: DateTime<Utc>,
    pub start_time: String,
    pub end_time: String,
    pub title: String,
    pub subject: Option<String>,
    pub notes: Option<String>,
}

async fn get_schedules(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Schedule>>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let coll = state.db.collection::<Schedule>("schedules");

    let mut cursor = coll
        .find(doc! { "userId": user_id })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut schedules = Vec::new();
    while let Some(item) = cursor.try_next().await.unwrap_or(None) {
        schedules.push(item);
    }

    Ok(Json(schedules))
}

async fn create_schedule(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateSchedulePayload>,
) -> Result<Json<Schedule>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let coll = state.db.collection::<Schedule>("schedules");

    let now = Utc::now();
    let new_item = Schedule {
        id: None,
        user_id,
        date: payload.date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        title: payload.title,
        subject: payload.subject,
        notes: payload.notes,
        completed: false,
        created_at: now,
        updated_at: now,
    };

    let result = coll
        .insert_one(new_item.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut inserted = new_item;
    inserted.id = result.inserted_id.as_object_id();

    Ok(Json(inserted))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSchedulePayload {
    pub title: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub completed: Option<bool>,
}

async fn update_schedule(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSchedulePayload>,
) -> Result<Json<Schedule>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let item_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let coll = state.db.collection::<Schedule>("schedules");
    let filter = doc! { "_id": item_id, "userId": user_id };

    let mut update_doc = mongodb::bson::Document::new();
    if let Some(t) = payload.title {
        update_doc.insert("title", t);
    }
    if let Some(st) = payload.start_time {
        update_doc.insert("startTime", st);
    }
    if let Some(et) = payload.end_time {
        update_doc.insert("endTime", et);
    }
    if let Some(c) = payload.completed {
        update_doc.insert("completed", c);
    }

    update_doc.insert("updatedAt", Utc::now().to_rfc3339());

    if update_doc.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No update fields provided".into()));
    }

    coll.update_one(filter.clone(), doc! { "$set": update_doc })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated = coll
        .find_one(filter)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Not found".into()))?;

    Ok(Json(updated))
}

async fn delete_schedule(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let item_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let coll = state.db.collection::<Schedule>("schedules");
    coll.delete_one(doc! { "_id": item_id, "userId": user_id })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}
