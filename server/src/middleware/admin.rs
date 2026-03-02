use crate::middleware::auth::AuthUser;
use axum::{
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
    Extension,
};

pub async fn is_admin(
    Extension(auth_user): Extension<AuthUser>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, (StatusCode, axum::Json<serde_json::Value>)> {
    if auth_user.0.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({
                "error": "Forbidden",
                "message": "Admin access required"
            })),
        ));
    }

    Ok(next.run(req).await)
}
