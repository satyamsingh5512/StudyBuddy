use crate::{models::User, utils::jwt::verify_jwt, AppState};
use axum::{
    extract::State,
    http::{header, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::cookie::CookieJar;
use mongodb::bson::doc;
use mongodb::bson::oid::ObjectId;
use std::str::FromStr;
use std::sync::Arc;

#[derive(Clone)]
pub struct AuthUser(pub User);

pub async fn is_authenticated(
    cookie_jar: CookieJar,
    State(state): State<Arc<AppState>>,
    mut req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, (StatusCode, axum::Json<serde_json::Value>)> {
    let token = cookie_jar
        .get("connect.sid")
        .map(|c| c.value().to_string())
        .or_else(|| {
            req.headers()
                .get(header::AUTHORIZATION)
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.strip_prefix("Bearer ").map(|s| s.to_string()))
        });

    let token = match token {
        Some(t) => t,
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({
                    "error": "Unauthorized",
                    "message": "Please login to access this resource"
                })),
            ));
        }
    };

    let claims = match verify_jwt(&token) {
        Ok(c) => c,
        Err(_) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({
                    "error": "Unauthorized",
                    "message": "Invalid or expired token"
                })),
            ));
        }
    };

    let user_id = match ObjectId::from_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({ "error": "Invalid user ID" })),
            ));
        }
    };

    let users = state.db.collection::<User>("users");
    let user = match users.find_one(doc! { "_id": user_id }).await {
        Ok(Some(u)) => u,
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({
                    "error": "User not found",
                    "message": "Please login again"
                })),
            ));
        }
    };

    req.extensions_mut().insert(AuthUser(user));
    Ok(next.run(req).await)
}
