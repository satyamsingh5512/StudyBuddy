use crate::{
    middleware::auth::{is_authenticated, AuthUser},
    models::User,
    utils::jwt::create_jwt,
    AppState,
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    routing::{get, post},
    Extension, Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use bcrypt::verify;
use chrono::Utc;
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};
use std::{env, sync::Arc};

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/login", post(login))
        .route("/signup", post(signup))
        .route("/verify-otp", post(verify_otp))
        .route("/resend-otp", post(resend_otp))
        .route("/forgot-password", post(forgot_password))
        .route("/reset-password", post(reset_password))
        .route(
            "/me",
            get(get_me).route_layer(axum::middleware::from_fn_with_state(
                state,
                is_authenticated,
            )),
        )
        .route("/logout", post(logout))
        .route("/google", get(google_login))
        .route("/google/callback", get(google_callback))
        .route("/google/mobile", post(google_mobile))
}

// ─── Standard Auth ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginPayload {
    pub email: String,
    pub password: Option<String>,
}

#[derive(Deserialize)]
pub struct SignupPayload {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct VerifyOtpPayload {
    pub email: String,
    pub otp: String,
}

#[derive(Deserialize)]
pub struct ForgotPasswordPayload {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordPayload {
    pub email: String,
    pub otp: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
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

    let jar = set_auth_cookie(jar, token.clone());

    Ok((
        jar,
        Json(AuthResponse {
            message: "Login successful".into(),
            user: Some(user),
            error: None,
            token: Some(token),
        }),
    ))
}

async fn signup(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SignupPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<AuthResponse>)> {
    let email = payload.email.to_lowercase();
    let users = state.db.collection::<User>("users");

    if users.find_one(doc! { "email": &email }).await.unwrap().is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                message: "Email already exists".into(),
                user: None,
                error: Some("Email already exists".into()),
                token: None,
            }),
        ));
    }

    let hashed_password = bcrypt::hash(payload.password, bcrypt::DEFAULT_COST).unwrap();
    let otp = format!("{:06}", (chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0) % 1_000_000).abs());
    let otp_expiry = Utc::now() + chrono::Duration::minutes(10);

    let mut user = User {
        id: None,
        email: email.clone(),
        password: Some(hashed_password),
        google_id: None,
        name: payload.name.clone(),
        username: format!("user_{}", &uuid::Uuid::new_v4().to_string()[..8]),
        avatar: None,
        avatar_type: None,
        role: "user".to_string(),
        exam_goal: None,
        exam_date: None,
        exam_attempt: None,
        student_class: None,
        batch: None,
        syllabus: None,
        email_verified: false,
        verification_otp: Some(otp.clone()),
        otp_expiry: Some(otp_expiry),
        reset_token: None,
        reset_token_expiry: None,
        onboarding_done: Some(false),
        total_points: 0,
        total_study_minutes: 0,
        streak: 0,
        subjects: None,
        refresh_token_hash: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        last_active: Utc::now(),
        show_profile: true,
    };

    let result = users.insert_one(&user).await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthResponse {
                message: "Database error".into(),
                user: None,
                error: Some("Database error".into()),
                token: None,
            }),
        )
    })?;
    
    user.id = Some(result.inserted_id.as_object_id().unwrap());

    // In a real app, send email here. For now, we assume it's "sent".
    tracing::info!("Verification OTP for {}: {}", email, otp);

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            message: "Signup successful. Please verify your email.".into(),
            user: Some(user),
            error: None,
            token: None,
        }),
    ))
}

async fn verify_otp(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(payload): Json<VerifyOtpPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<AuthResponse>)> {
    let email = payload.email.to_lowercase();
    let users = state.db.collection::<User>("users");

    let user = match users.find_one(doc! { "email": &email }).await {
        Ok(Some(u)) => u,
        _ => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(AuthResponse {
                    message: "User not found".into(),
                    user: None,
                    error: Some("User not found".into()),
                    token: None,
                }),
            ));
        }
    };

    if user.verification_otp.as_deref() != Some(&payload.otp) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                message: "Invalid OTP".into(),
                user: None,
                error: Some("Invalid OTP".into()),
                token: None,
            }),
        ));
    }

    if let Some(expiry) = user.otp_expiry {
        if Utc::now() > expiry {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(AuthResponse {
                    message: "OTP expired".into(),
                    user: None,
                    error: Some("OTP expired".into()),
                    token: None,
                }),
            ));
        }
    }

    users.update_one(
        doc! { "email": &email },
        doc! { "$set": { "emailVerified": true, "verificationOtp": null, "otpExpiry": null } },
    ).await.ok();

    let user_id = user.id.expect("User should have an id");
    let token = create_jwt(&user_id, &user.email, &user.role).unwrap();
    let jar = set_auth_cookie(jar, token.clone());

    let mut updated_user = user;
    updated_user.email_verified = true;

    Ok((
        jar,
        Json(AuthResponse {
            message: "Email verified successfully".into(),
            user: Some(updated_user),
            error: None,
            token: Some(token),
        }),
    ))
}

async fn resend_otp(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ForgotPasswordPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<AuthResponse>)> {
    let email = payload.email.to_lowercase();
    let users = state.db.collection::<User>("users");

    let otp = format!("{:06}", (chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0) % 1_000_000).abs());
    let otp_expiry = Utc::now() + chrono::Duration::minutes(10);

    let result = users.update_one(
        doc! { "email": &email },
        doc! { "$set": { "verificationOtp": &otp, "otpExpiry": otp_expiry } },
    ).await;

    match result {
        Ok(res) if res.matched_count > 0 => {
            tracing::info!("Resent OTP for {}: {}", email, otp);
            Ok(Json(AuthResponse {
                message: "OTP resent successfully".into(),
                user: None,
                error: None,
                token: None,
            }))
        }
        _ => Err((
            StatusCode::NOT_FOUND,
            Json(AuthResponse {
                message: "User not found".into(),
                user: None,
                error: Some("User not found".into()),
                token: None,
            }),
        )),
    }
}

async fn forgot_password(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ForgotPasswordPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<AuthResponse>)> {
    let email = payload.email.to_lowercase();
    let users = state.db.collection::<User>("users");

    let otp = format!("{:06}", (chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0) % 1_000_000).abs());
    let otp_expiry = Utc::now() + chrono::Duration::minutes(10);

    let result = users.update_one(
        doc! { "email": &email },
        doc! { "$set": { "resetToken": &otp, "resetTokenExpiry": otp_expiry } },
    ).await;

    match result {
        Ok(res) if res.matched_count > 0 => {
            tracing::info!("Reset OTP for {}: {}", email, otp);
            Ok(Json(AuthResponse {
                message: "Password reset code sent".into(),
                user: None,
                error: None,
                token: None,
            }))
        }
        _ => Err((
            StatusCode::NOT_FOUND,
            Json(AuthResponse {
                message: "User not found".into(),
                user: None,
                error: Some("User not found".into()),
                token: None,
            }),
        )),
    }
}

async fn reset_password(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ResetPasswordPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<AuthResponse>)> {
    let email = payload.email.to_lowercase();
    let users = state.db.collection::<User>("users");

    let user = match users.find_one(doc! { "email": &email }).await {
        Ok(Some(u)) => u,
        _ => return Err((StatusCode::NOT_FOUND, Json(AuthResponse { message: "User not found".into(), user: None, error: Some("User not found".into()), token: None }))),
    };

    if user.reset_token.as_deref() != Some(&payload.otp) {
        return Err((StatusCode::BAD_REQUEST, Json(AuthResponse { message: "Invalid reset code".into(), user: None, error: Some("Invalid reset code".into()), token: None })));
    }

    if let Some(expiry) = user.reset_token_expiry {
        if Utc::now() > expiry {
            return Err((StatusCode::BAD_REQUEST, Json(AuthResponse { message: "Reset code expired".into(), user: None, error: Some("Reset code expired".into()), token: None })));
        }
    }

    let hashed_password = bcrypt::hash(payload.password, bcrypt::DEFAULT_COST).unwrap();

    users.update_one(
        doc! { "email": &email },
        doc! { "$set": { "password": hashed_password, "resetToken": null, "resetTokenExpiry": null } },
    ).await.ok();

    Ok(Json(AuthResponse {
        message: "Password reset successful".into(),
        user: None,
        error: None,
        token: None,
    }))
}

async fn get_me(Extension(auth_user): Extension<AuthUser>) -> Json<User> {
    Json(auth_user.0)
}

async fn logout(jar: CookieJar) -> Result<impl IntoResponse, StatusCode> {
    let mut cookie = Cookie::from("connect.sid");
    cookie.set_path("/");
    
    let is_prod = std::env::var("NODE_ENV").unwrap_or_default() == "production";
    if is_prod {
        cookie.set_same_site(SameSite::None);
        cookie.set_secure(true);
    } else {
        cookie.set_same_site(SameSite::Lax);
        cookie.set_secure(false);
    }
    
    let updated_jar = jar.remove(cookie);

    Ok((updated_jar, Json(serde_json::json!({ "success": true }))))
}

// ─── Google OAuth (Web — redirect flow) ──────────────────────────────────────

/// Step 1: redirect user to Google's consent page.
async fn google_login() -> impl IntoResponse {
    let client_id = env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
    let redirect_uri = env::var("GOOGLE_CALLBACK_URL")
        .unwrap_or_else(|_| "https://sbd.satym.in/api/auth/google/callback".into());

    let url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
         ?client_id={client_id}\
         &redirect_uri={redirect_uri}\
         &response_type=code\
         &scope=openid%20email%20profile\
         &access_type=offline\
         &prompt=select_account"
    );

    Redirect::temporary(&url)
}

#[derive(Deserialize)]
pub struct OAuthCallbackParams {
    pub code: Option<String>,
    pub error: Option<String>,
}

/// Step 2: Google redirects back here with `?code=...`
async fn google_callback(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OAuthCallbackParams>,
    jar: CookieJar,
) -> impl IntoResponse {
    let client_url = env::var("CLIENT_URL").unwrap_or_else(|_| "https://sbd.satym.in".into());

    // If Google returned an error (e.g. user denied), send them back with error param
    if params.error.is_some() || params.code.is_none() {
        return (jar, Redirect::temporary(&format!("{client_url}/auth?error=google_failed")));
    }

    let code = params.code.unwrap();

    match exchange_google_code_and_upsert_user(&state, &code, &jar).await {
        Ok((updated_jar, next, token)) => {
            let redirect_url = format!("{client_url}/auth/google/callback?next={next}&token={token}");
            // Redirect::to in axum uses 303 See Other by default
            (updated_jar, Redirect::to(&redirect_url))
        }
        Err(_) => {
            (jar, Redirect::temporary(&format!("{client_url}/auth?error=google_failed")))
        }
    }
}

// ─── Google OAuth (Native — token exchange) ───────────────────────────────────

#[derive(Deserialize)]
pub struct MobileGooglePayload {
    pub id_token: Option<String>,
    #[serde(rename = "idToken")]
    pub id_token_camel: Option<String>,
}

#[derive(Serialize)]
pub struct MobileAuthResponse {
    pub message: String,
    pub user: User,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

async fn google_mobile(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(payload): Json<MobileGooglePayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let id_token = payload
        .id_token
        .or(payload.id_token_camel)
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "id_token is required" })),
            )
        })?;

    // Verify the ID token with Google
    let google_user = verify_google_id_token(&id_token).await.map_err(|e| {
        tracing::error!("Google ID token verification failed: {e}");
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Invalid Google token" })),
        )
    })?;

    let user = upsert_google_user(&state, &google_user).await.map_err(|e| {
        tracing::error!("Failed to upsert Google user: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;

    let user_id = user.id.clone().expect("user should have id");
    let token = create_jwt(&user_id, &user.email, &user.role).unwrap();
    let updated_jar = set_auth_cookie(jar, token.clone());

    Ok((
        updated_jar,
        Json(MobileAuthResponse {
            message: "Login successful".into(),
            user,
            token: Some(token),
        }),
    ))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Google's userinfo payload (what we need from the tokeninfo/userinfo endpoint)
#[derive(Deserialize)]
struct GoogleUserInfo {
    pub sub: String,        // Google unique ID
    pub email: String,
    pub email_verified: Option<bool>,
    pub name: Option<String>,
    pub picture: Option<String>,
}

/// Exchange OAuth2 code for tokens, then call userinfo, then upsert user.
/// Returns the CookieJar with the auth cookie set, "dashboard" or "onboarding", and the JWT token.
async fn exchange_google_code_and_upsert_user(
    state: &Arc<AppState>,
    code: &str,
    jar: &CookieJar,
) -> anyhow::Result<(CookieJar, &'static str, String)> {
    let client_id = env::var("GOOGLE_CLIENT_ID")?;
    let client_secret = env::var("GOOGLE_CLIENT_SECRET")?;
    let redirect_uri = env::var("GOOGLE_CALLBACK_URL")
        .unwrap_or_else(|_| "https://sbd.satym.in/api/auth/google/callback".into());

    let http = reqwest::Client::new();

    // Exchange code for tokens
    let token_res: serde_json::Value = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("redirect_uri", &redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?
        .json()
        .await?;

    let access_token = token_res["access_token"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("No access_token in Google response"))?;

    // Get user info from Google
    let user_info: GoogleUserInfo = http
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(access_token)
        .send()
        .await?
        .json()
        .await?;

    let user = upsert_google_user(state, &user_info).await?;
    let is_new = user.onboarding_done.map(|d| !d).unwrap_or(true);
    let next = if is_new { "onboarding" } else { "dashboard" };

    let user_id = user.id.expect("user should have id");
    let token = create_jwt(&user_id, &user.email, &user.role)?;
    let updated_jar = set_auth_cookie(jar.clone(), token.clone());

    Ok((updated_jar, next, token))
}

/// Verify a Google ID token using Google's tokeninfo endpoint.
async fn verify_google_id_token(id_token: &str) -> anyhow::Result<GoogleUserInfo> {
    let http = reqwest::Client::new();
    let info: GoogleUserInfo = http
        .get("https://oauth2.googleapis.com/tokeninfo")
        .query(&[("id_token", id_token)])
        .send()
        .await?
        .json()
        .await?;
    Ok(info)
}

/// Find user by google_id or email; create if not found.
async fn upsert_google_user(
    state: &Arc<AppState>,
    info: &GoogleUserInfo,
) -> anyhow::Result<User> {
    let users = state.db.collection::<User>("users");
    let now = Utc::now();

    // Try to find by google_id first, then by email
    let existing = users
        .find_one(doc! { "googleId": &info.sub })
        .await?
        .or(users.find_one(doc! { "email": &info.email }).await?);

    if let Some(mut user) = existing {
        // Update google_id if missing (linking an existing email account)
        if user.google_id.is_none() {
            users
                .update_one(
                    doc! { "_id": user.id },
                    doc! { "$set": { "googleId": &info.sub } },
                )
                .await?;
            user.google_id = Some(info.sub.clone());
        }
        return Ok(user);
    }

    // Create new user
    let name = info
        .name
        .clone()
        .unwrap_or_else(|| info.email.split('@').next().unwrap_or("User").to_string());

    // Generate a unique username from name
    let base_username = name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>();
    let username = format!("{}{}", base_username, &uuid::Uuid::new_v4().to_string()[..6]);

    let new_user = User {
        id: None,
        email: info.email.clone(),
        password: None,
        google_id: Some(info.sub.clone()),
        name,
        username,
        avatar: info.picture.clone(),
        avatar_type: info.picture.as_ref().map(|_| "url".to_string()),
        role: "user".to_string(),
        exam_goal: None,
        exam_date: None,
        exam_attempt: None,
        student_class: None,
        batch: None,
        syllabus: None,
        email_verified: true,
        verification_otp: None,
        otp_expiry: None,
        reset_token: None,
        reset_token_expiry: None,
        onboarding_done: Some(false),
        total_points: 0,
        total_study_minutes: 0,
        streak: 0,
        subjects: None,
        refresh_token_hash: None,
        created_at: now,
        updated_at: now,
        last_active: now,
        show_profile: true,
    };

    let result = users.insert_one(&new_user).await?;
    let inserted_id = result.inserted_id.as_object_id().unwrap();

    Ok(User {
        id: Some(inserted_id),
        ..new_user
    })
}

/// Build an HttpOnly JWT cookie valid for 30 days.
fn set_auth_cookie(jar: CookieJar, token: String) -> CookieJar {
    let mut cookie = Cookie::new("connect.sid", token);
    cookie.set_http_only(true);
    cookie.set_path("/");
    
    // In production, use SameSite::None and Secure=true for cross-origin cookies.
    // Ensure both frontend and backend are on HTTPS.
    let is_prod = std::env::var("NODE_ENV").unwrap_or_default() == "production";
    if is_prod {
        cookie.set_same_site(SameSite::None);
        cookie.set_secure(true);
    } else {
        cookie.set_same_site(SameSite::Lax);
        cookie.set_secure(false);
    }
    
    // 30 days in seconds
    cookie.set_max_age(time::Duration::seconds(30 * 24 * 60 * 60));
    jar.add(cookie)
}
