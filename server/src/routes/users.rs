use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::User,
    AppState,
};
use axum::{extract::State, http::StatusCode, routing::get, Extension, Json, Router};
use futures::stream::TryStreamExt;
use mongodb::bson::doc;
use serde::Deserialize;
use std::sync::Arc;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/profile", get(get_profile).put(update_profile))
        .route("/leaderboard", get(get_leaderboard))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

async fn get_profile(Extension(auth_user): Extension<AuthUser>) -> Json<User> {
    Json(auth_user.0)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfilePayload {
    pub name: Option<String>,
    pub exam_goal: Option<String>,
    pub student_class: Option<String>,
    pub batch: Option<String>,
    pub syllabus: Option<String>,
    pub subjects: Option<Vec<String>>,
}

async fn update_profile(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<UpdateProfilePayload>,
) -> Result<Json<User>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let users_coll = state.db.collection::<User>("users");

    let mut update_doc = mongodb::bson::Document::new();
    if let Some(n) = payload.name {
        update_doc.insert("name", n);
    }
    if let Some(e) = payload.exam_goal {
        update_doc.insert("examGoal", e);
    }
    if let Some(s) = payload.student_class {
        update_doc.insert("studentClass", s);
    }
    if let Some(b) = payload.batch {
        update_doc.insert("batch", b);
    }
    if let Some(s) = payload.syllabus {
        update_doc.insert("syllabus", s);
    }
    if let Some(subs) = payload.subjects {
        let bson_subs: Vec<mongodb::bson::Bson> =
            subs.into_iter().map(mongodb::bson::Bson::String).collect();
        update_doc.insert("subjects", bson_subs);
    }

    if update_doc.is_empty() {
        return Ok(Json(auth_user.0));
    }

    update_doc.insert("updatedAt", chrono::Utc::now().to_rfc3339());

    users_coll
        .update_one(doc! { "_id": user_id }, doc! { "$set": update_doc })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated_user = users_coll
        .find_one(doc! { "_id": user_id })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    Ok(Json(updated_user))
}

async fn get_leaderboard(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<User>>, (StatusCode, String)> {
    let users_coll = state.db.collection::<User>("users");
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "totalPoints": -1 })
        .limit(50)
        .build();

    let mut cursor = users_coll
        .find(doc! {})
        .with_options(find_options)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut top_users = Vec::new();
    while let Some(user) = cursor.try_next().await.unwrap_or(None) {
        top_users.push(user);
    }

    Ok(Json(top_users))
}
