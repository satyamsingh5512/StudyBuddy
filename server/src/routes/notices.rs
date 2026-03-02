use crate::{models::Notice, AppState};
use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use futures::stream::TryStreamExt;
use mongodb::bson::doc;
use std::sync::Arc;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", get(get_notices))
}

async fn get_notices(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Notice>>, (StatusCode, String)> {
    let coll = state.db.collection::<Notice>("notices");
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();

    let mut cursor = coll
        .find(doc! {})
        .with_options(find_options)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut notices = Vec::new();
    while let Some(item) = cursor.try_next().await.unwrap_or(None) {
        notices.push(item);
    }

    Ok(Json(notices))
}
