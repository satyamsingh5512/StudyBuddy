use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::DailyReport,
    AppState,
};
use axum::{extract::State, http::StatusCode, routing::get, Extension, Json, Router};
use chrono::Utc;
use futures::stream::TryStreamExt;
use mongodb::bson::doc;
use serde::Deserialize;
use std::sync::Arc;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_reports).post(create_report))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

async fn get_reports(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<DailyReport>>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let coll = state.db.collection::<DailyReport>("daily_reports");

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "date": -1 })
        .limit(30)
        .build();

    let mut cursor = coll
        .find(doc! { "userId": user_id })
        .with_options(find_options)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut reports = Vec::new();
    while let Some(item) = cursor.try_next().await.unwrap_or(None) {
        reports.push(item);
    }

    Ok(Json(reports))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReportPayload {
    pub date: chrono::DateTime<Utc>,
    pub study_hours: f64,
    pub hours_logged: Option<f64>,
    pub points_earned: Option<i32>,
    pub completion_pct: Option<f64>,
    pub notes: Option<String>,
}

async fn create_report(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateReportPayload>,
) -> Result<Json<DailyReport>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let coll = state.db.collection::<DailyReport>("daily_reports");

    let now = Utc::now();
    let report = DailyReport {
        id: None,
        user_id,
        date: payload.date,
        study_hours: payload.study_hours,
        hours_logged: payload.hours_logged,
        points_earned: payload.points_earned,
        completion_pct: payload.completion_pct,
        notes: payload.notes,
        created_at: now,
        updated_at: now,
    };

    let result = coll
        .insert_one(report.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut inserted = report;
    inserted.id = result.inserted_id.as_object_id();

    Ok(Json(inserted))
}
