use crate::{models::FAQ, AppState};
use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use futures::stream::TryStreamExt;
use mongodb::bson::doc;
use std::sync::Arc;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", get(get_faqs))
}

async fn get_faqs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<FAQ>>, (StatusCode, String)> {
    let coll = state.db.collection::<FAQ>("faqs");
    let mut cursor = coll
        .find(doc! { "published": true })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut faqs = Vec::new();
    while let Some(item) = cursor.try_next().await.unwrap_or(None) {
        faqs.push(item);
    }

    Ok(Json(faqs))
}
