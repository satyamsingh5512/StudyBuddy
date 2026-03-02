use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::{Todo, User},
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use futures::stream::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use std::{str::FromStr, sync::Arc};

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_todos).post(create_todo))
        .route("/reschedule-all-overdue", post(reschedule_all_overdue))
        .route("/:id", patch(update_todo).delete(delete_todo))
        .route("/:id/reschedule", patch(reschedule_todo))
        .route("/:id/reschedule-to-today", post(reschedule_to_today))
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            is_authenticated,
        ))
}

fn get_start_of_day(date: DateTime<Utc>) -> DateTime<Utc> {
    date.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc()
}

fn is_overdue(scheduled_date: DateTime<Utc>) -> bool {
    let today = get_start_of_day(Utc::now());
    let scheduled = get_start_of_day(scheduled_date);
    scheduled < today
}

const POINTS_ON_TIME_COMPLETION: f64 = 2.0;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoResponse {
    #[serde(flatten)]
    pub todo: Todo,
    pub id: String,
    pub is_overdue: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub points_awarded: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub points_credited: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTodoPayload {
    pub title: String,
    pub subject: String,
    pub difficulty: String,
    pub questions_target: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_date: Option<DateTime<Utc>>,
}

async fn get_todos(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<TodoResponse>>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let todos_coll = state.db.collection::<Todo>("todos");

    let mut cursor = todos_coll
        .find(doc! { "userId": user_id })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut todos = Vec::new();

    while let Some(todo) = cursor.try_next().await.unwrap_or(None) {
        let is_overdue = !todo.completed && is_overdue(todo.scheduled_date);
        let id = todo.id.unwrap().to_string();

        todos.push(TodoResponse {
            todo,
            id,
            is_overdue,
            points_awarded: None,
            points_credited: None,
        });
    }

    Ok(Json(todos))
}

async fn create_todo(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CreateTodoPayload>,
) -> Result<Json<TodoResponse>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let todos_coll = state.db.collection::<Todo>("todos");

    let scheduled_date = payload
        .scheduled_date
        .unwrap_or_else(|| get_start_of_day(Utc::now()));

    let new_todo = Todo {
        id: None,
        user_id,
        title: payload.title,
        subject: payload.subject,
        difficulty: payload.difficulty,
        questions_target: payload.questions_target,
        questions_completed: 0,
        completed: false,
        scheduled_date,
        rescheduled_count: 0,
        original_scheduled_date: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        completed_at: None,
    };

    let result = todos_coll
        .insert_one(new_todo.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut inserted_todo = new_todo;
    inserted_todo.id = result.inserted_id.as_object_id();
    let id = inserted_todo.id.unwrap().to_string();

    Ok(Json(TodoResponse {
        todo: inserted_todo,
        id,
        is_overdue: false,
        points_awarded: None,
        points_credited: None,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTodoPayload {
    pub title: Option<String>,
    pub subject: Option<String>,
    pub difficulty: Option<String>,
    pub questions_target: Option<i32>,
    pub questions_completed: Option<i32>,
    pub completed: Option<bool>,
}

async fn update_todo(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTodoPayload>,
) -> Result<Json<TodoResponse>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let todo_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let todos_coll = state.db.collection::<Todo>("todos");
    let filter = doc! { "_id": todo_id, "userId": user_id };

    let existing_todo = todos_coll
        .find_one(filter.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Todo not found".into()))?;

    let mut update_doc = mongodb::bson::Document::new();

    if let Some(c) = payload.completed {
        update_doc.insert("completed", c);
    }
    if let Some(t) = payload.title {
        update_doc.insert("title", t);
    }
    if let Some(s) = payload.subject {
        update_doc.insert("subject", s);
    }
    if let Some(d) = payload.difficulty {
        update_doc.insert("difficulty", d);
    }
    if let Some(qt) = payload.questions_target {
        update_doc.insert("questionsTarget", qt);
    }
    if let Some(qc) = payload.questions_completed {
        update_doc.insert("questionsCompleted", qc);
    }

    update_doc.insert("updatedAt", Utc::now().to_rfc3339());

    if update_doc.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No valid update fields".into()));
    }

    todos_coll
        .update_one(filter.clone(), doc! { "$set": update_doc })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated_todo = todos_coll
        .find_one(filter)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap();

    let mut points_to_award: f64 = 0.0;

    if payload.completed == Some(true) && !existing_todo.completed {
        points_to_award = 0.5;
        let today = get_start_of_day(Utc::now());
        let scheduled_date = get_start_of_day(existing_todo.scheduled_date);

        let original_scheduled_date = existing_todo
            .original_scheduled_date
            .map(get_start_of_day);

        if scheduled_date == today {
            if original_scheduled_date.is_none() || original_scheduled_date == Some(today) {
                points_to_award = 1.0;
            } else {
                points_to_award = 0.5;
            }
        } else if scheduled_date < today {
            points_to_award = 0.5;
        }

        let points_to_increment = if points_to_award == 0.5 {
            1
        } else {
            points_to_award.round() as i32
        };

        if points_to_increment > 0 {
            let users_coll = state.db.collection::<User>("users");
            let _ = users_coll
                .update_one(
                    doc! { "_id": user_id },
                    doc! {
                        "$inc": { "totalPoints": points_to_increment },
                        "$set": { "lastActive": Utc::now().to_rfc3339() }
                    },
                )
                .await;
        }
    }

    let id = updated_todo.id.unwrap().to_string();
    let is_overdue_flag = !updated_todo.completed && is_overdue(updated_todo.scheduled_date);

    Ok(Json(TodoResponse {
        todo: updated_todo,
        id,
        is_overdue: is_overdue_flag,
        points_awarded: if payload.completed == Some(true) && !existing_todo.completed {
            Some(points_to_award)
        } else {
            None
        },
        points_credited: None,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReschedulePayload {
    pub new_date: DateTime<Utc>,
}

async fn reschedule_todo(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(payload): Json<ReschedulePayload>,
) -> Result<Json<TodoResponse>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let todo_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let todos_coll = state.db.collection::<Todo>("todos");
    let filter = doc! { "_id": todo_id, "userId": user_id };

    let existing_todo = todos_coll
        .find_one(filter.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Todo not found".into()))?;

    if existing_todo.completed {
        return Err((
            StatusCode::BAD_REQUEST,
            "Cannot reschedule a completed task".into(),
        ));
    }

    let new_scheduled_date = get_start_of_day(payload.new_date);
    let today = get_start_of_day(Utc::now());

    if new_scheduled_date < today {
        return Err((
            StatusCode::BAD_REQUEST,
            "Cannot schedule a task in the past".into(),
        ));
    }

    let mut update_doc = doc! {
        "scheduledDate": new_scheduled_date.to_rfc3339(),
        "rescheduledCount": existing_todo.rescheduled_count + 1,
        "updatedAt": Utc::now().to_rfc3339()
    };

    if existing_todo.rescheduled_count == 0 {
        update_doc.insert(
            "originalScheduledDate",
            existing_todo.scheduled_date.to_rfc3339(),
        );
    }

    todos_coll
        .update_one(filter.clone(), doc! { "$set": update_doc })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated_todo = todos_coll.find_one(filter).await.unwrap().unwrap();
    let points_to_credit = (POINTS_ON_TIME_COMPLETION / 2.0).floor() as i32;

    let users_coll = state.db.collection::<User>("users");
    let _ = users_coll
        .update_one(
            doc! { "_id": user_id },
            doc! {
                "$inc": { "totalPoints": points_to_credit },
                "$set": { "lastActive": Utc::now().to_rfc3339() }
            },
        )
        .await;

    let id = updated_todo.id.unwrap().to_string();

    Ok(Json(TodoResponse {
        todo: updated_todo,
        id,
        is_overdue: false,
        points_awarded: None,
        points_credited: Some(points_to_credit as f64),
    }))
}

async fn reschedule_to_today(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<TodoResponse>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let todo_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let todos_coll = state.db.collection::<Todo>("todos");
    let filter = doc! { "_id": todo_id, "userId": user_id };

    let existing_todo = todos_coll
        .find_one(filter.clone())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Todo not found".into()))?;

    if existing_todo.completed {
        return Err((
            StatusCode::BAD_REQUEST,
            "Cannot reschedule a completed task".into(),
        ));
    }

    let today = get_start_of_day(Utc::now());

    let mut update_doc = doc! {
        "scheduledDate": today.to_rfc3339(),
        "rescheduledCount": existing_todo.rescheduled_count + 1,
        "updatedAt": Utc::now().to_rfc3339()
    };

    if existing_todo.rescheduled_count == 0 {
        update_doc.insert(
            "originalScheduledDate",
            existing_todo.scheduled_date.to_rfc3339(),
        );
    }

    todos_coll
        .update_one(filter.clone(), doc! { "$set": update_doc })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated_todo = todos_coll.find_one(filter).await.unwrap().unwrap();
    let points_to_credit = (POINTS_ON_TIME_COMPLETION / 2.0).floor() as i32;

    let users_coll = state.db.collection::<User>("users");
    let _ = users_coll
        .update_one(
            doc! { "_id": user_id },
            doc! {
                "$inc": { "totalPoints": points_to_credit },
                "$set": { "lastActive": Utc::now().to_rfc3339() }
            },
        )
        .await;

    let id = updated_todo.id.unwrap().to_string();

    Ok(Json(TodoResponse {
        todo: updated_todo,
        id,
        is_overdue: false,
        points_awarded: None,
        points_credited: Some(points_to_credit as f64),
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RescheduleAllPayload {
    pub target_date: Option<DateTime<Utc>>,
}

async fn reschedule_all_overdue(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<RescheduleAllPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();

    let schedule_to = payload
        .target_date
        .map(get_start_of_day)
        .unwrap_or_else(|| get_start_of_day(Utc::now()));
    let today = get_start_of_day(Utc::now());

    if schedule_to < today {
        return Err((
            StatusCode::BAD_REQUEST,
            "Cannot schedule tasks in the past".into(),
        ));
    }

    let todos_coll = state.db.collection::<Todo>("todos");

    // Fetch all incomplete tasks
    let mut cursor = todos_coll
        .find(doc! { "userId": user_id, "completed": false })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut overdue_ids = Vec::new();

    while let Some(todo) = cursor.try_next().await.unwrap_or(None) {
        if is_overdue(todo.scheduled_date) {
            overdue_ids.push(todo.id.unwrap());
        }
    }

    if overdue_ids.is_empty() {
        return Ok(Json(serde_json::json!({
            "message": "No overdue tasks to reschedule",
            "count": 0
        })));
    }

    let result = todos_coll.update_many(
        doc! { "_id": { "$in": &overdue_ids } },
        doc! {
            "$set": { "scheduledDate": schedule_to.to_rfc3339(), "updatedAt": Utc::now().to_rfc3339() },
            "$inc": { "rescheduledCount": 1 }
        }
    ).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("{} task(s) rescheduled", result.modified_count),
        "count": result.modified_count
    })))
}

async fn delete_todo(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = auth_user.0.id.unwrap();
    let todo_id =
        ObjectId::from_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid ID".into()))?;

    let todos_coll = state.db.collection::<Todo>("todos");
    todos_coll
        .delete_one(doc! { "_id": todo_id, "userId": user_id })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}
