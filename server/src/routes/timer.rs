use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::{DailyReport, TimerSession, User},
    AppState,
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::{Duration, Utc};
use futures::stream::TryStreamExt;
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/session", post(save_session))
        .route("/analytics", get(get_analytics))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

#[derive(Deserialize)]
pub struct AnalyticsQuery {
    pub days: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsDay {
    pub date: String,
    pub study_hours: f64,
    pub tasks_completed: i32,
    pub understanding: i32,
    pub sessions: i32,
    pub session_types: HashMap<String, i32>,
}

async fn get_analytics(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Json<Vec<AnalyticsDay>>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let days = query.days.unwrap_or(7);

    let now = Utc::now();
    let start_date = now - Duration::days(days);

    let timer_coll = state.db.collection::<TimerSession>("timer_sessions");
    let reports_coll = state.db.collection::<DailyReport>("daily_reports");

    let mut sessions_cursor = timer_coll
        .find(doc! {
            "userId": user_id,
            "createdAt": { "$gte": start_date.to_rfc3339() }
        })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut sessions = Vec::new();
    while let Some(s) = sessions_cursor.try_next().await.unwrap_or(None) {
        sessions.push(s);
    }

    let mut reports_cursor = reports_coll
        .find(doc! {
            "userId": user_id,
            "date": { "$gte": start_date.to_rfc3339() }
        })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut reports = Vec::new();
    while let Some(r) = reports_cursor.try_next().await.unwrap_or(None) {
        reports.push(r);
    }

    let mut analytics = Vec::new();
    for i in 0..days {
        let current_date = start_date + Duration::days(i);
        let date_str = current_date.format("%Y-%m-%d").to_string();

        let day_sessions: Vec<&TimerSession> = sessions
            .iter()
            .filter(|s| s.created_at.format("%Y-%m-%d").to_string() == date_str)
            .collect();

        let study_hours: f64 = day_sessions.iter().map(|s| s.duration as f64).sum::<f64>() / 60.0;

        let report = reports
            .iter()
            .find(|r| r.date.format("%Y-%m-%d").to_string() == date_str);

        let mut session_types = HashMap::new();
        for s in &day_sessions {
            let s_type = s.subject.clone().unwrap_or_else(|| "General".to_string());
            *session_types.entry(s_type).or_insert(0) += 1;
        }

        // We use points_earned as a proxy for tasks_completed as it's missing in Rust DailyReport
        let tasks_completed = report.and_then(|r| r.points_earned).unwrap_or(0);
        let understanding = 0; // Not fully implemented in DB models

        analytics.push(AnalyticsDay {
            date: current_date.to_rfc3339(),
            study_hours,
            tasks_completed,
            understanding,
            sessions: day_sessions.len() as i32,
            session_types,
        });
    }

    Ok(Json(analytics))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSessionPayload {
    pub duration: i32, // minutes
    pub subject: Option<String>,
}

async fn save_session(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<SaveSessionPayload>,
) -> Result<Json<TimerSession>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let coll = state.db.collection::<TimerSession>("timer_sessions");
    let users_coll = state.db.collection::<User>("users");

    let new_session = TimerSession {
        id: None,
        user_id,
        duration: payload.duration,
        subject: payload.subject,
        created_at: Utc::now(),
    };

    let result = coll
        .insert_one(new_session.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update user's total study minutes
    users_coll.update_one(
        doc! {"_id": user_id },
        doc! {
            "$inc": { "totalStudyMinutes": payload.duration, "totalPoints": (payload.duration / 10) },
            "$set": { "lastActive": Utc::now().to_rfc3339() }
        }
    ).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut inserted = new_session;
    inserted.id = result.inserted_id.as_object_id();

    Ok(Json(inserted))
}
