use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::User,
    utils::jwt::create_jwt,
    AppState,
};
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use bcrypt::verify;
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/login", post(login))
        .route(
            "/me",
            get(get_me).route_layer(axum::middleware::from_fn_with_state(
                state,
                is_authenticated,
            )),
        )
        .route("/logout", post(logout))
}

#[derive(Deserialize)]
pub struct LoginPayload {
    pub email: String,
    pub password: Option<String>,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

async fn login(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(payload): Json<LoginPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<AuthResponse>)> {
    let email = payload.email.to_lowercase();
    let password = payload.password.unwrap_or_default();

    if email.is_empty() || password.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                message: "Email and password are required".into(),
                user: None,
                error: Some("Email and password are required".into()),
            }),
        ));
    }

    let users = state.db.collection::<User>("users");
    let user = match users.find_one(doc! { "email": &email }).await {
        Ok(Some(u)) => u,
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(AuthResponse {
                    message: "Invalid email or password".into(),
                    user: None,
                    error: Some("Invalid email or password".into()),
                }),
            ));
        }
    };

    if let Some(ref user_pass) = user.password {
        if !verify(&password, user_pass).unwrap_or(false) {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(AuthResponse {
                    message: "Invalid email or password".into(),
                    user: None,
                    error: Some("Invalid email or password".into()),
                }),
            ));
        }
    } else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(AuthResponse {
                message: "Invalid email or password".into(),
                user: None,
                error: Some("Invalid email or password".into()),
            }),
        ));
    }

    if !user.email_verified {
        return Err((
            StatusCode::FORBIDDEN,
            Json(AuthResponse {
                message: "Please verify your email first".into(),
                user: None,
                error: Some("Please verify your email first".into()),
            }),
        ));
    }

    let user_id = user.id.expect("User should have an id");
    let token = create_jwt(&user_id, &user.email, &user.role).unwrap();

    let mut cookie = Cookie::new("connect.sid", token.clone());
    cookie.set_http_only(true);
    cookie.set_path("/");
    // cookie.set_secure(true); // in production

    let updated_jar = jar.add(cookie);

    Ok((
        updated_jar,
        Json(AuthResponse {
            message: "Login successful".into(),
            user: Some(user),
            error: None,
        }),
    ))
}

async fn get_me(Extension(auth_user): Extension<AuthUser>) -> Json<User> {
    Json(auth_user.0)
}

async fn logout(jar: CookieJar) -> Result<impl IntoResponse, StatusCode> {
    let mut cookie = Cookie::from("connect.sid");
    cookie.set_path("/");
    let updated_jar = jar.remove(cookie);

    Ok((updated_jar, Json(serde_json::json!({ "success": true }))))
}
