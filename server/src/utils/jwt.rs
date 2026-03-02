use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // User ID
    pub email: String,
    pub role: String,
    pub exp: usize,
}

pub fn create_jwt(user_id: &ObjectId, email: &str, role: &str) -> anyhow::Result<String> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::days(30))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_owned(),
        role: role.to_owned(),
        exp: expiration as usize,
    };

    let secret =
        env::var("SESSION_SECRET").unwrap_or_else(|_| "supersecret_studybuddy_dev_key".to_string());

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok(token)
}

pub fn verify_jwt(token: &str) -> anyhow::Result<Claims> {
    let secret =
        env::var("SESSION_SECRET").unwrap_or_else(|_| "supersecret_studybuddy_dev_key".to_string());

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}
