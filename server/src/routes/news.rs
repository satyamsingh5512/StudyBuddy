use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use axum::http::StatusCode;

use crate::AppState;
use crate::middleware::auth::is_authenticated;

#[derive(Clone)]
struct CacheEntry {
    data: serde_json::Value,
    timestamp: u64,
}

// In-memory cache for news (Shared state)
type NewsCache = Arc<Mutex<HashMap<String, CacheEntry>>>;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let cache = Arc::new(Mutex::new(HashMap::new()));

    Router::new()
        .route("/:exam_type", get(get_news))
        .route("/:exam_type/dates", get(get_dates))
        .route("/cache/clear", post(clear_cache))
        .layer(axum::middleware::from_fn_with_state(state.clone(), is_authenticated))
        .with_state(cache)
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiGenerationConfig {
    temperature: f32,
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: u32,
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GeminiGenerationConfig,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiCandidateContent,
}

#[derive(Deserialize)]
struct GeminiCandidateContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    text: String,
}

async fn get_news(
    State(cache): State<NewsCache>,
    Path(exam_type): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let exam_type_upper = exam_type.to_uppercase();
    let valid_exams = ["JEE", "NEET", "GATE", "UPSC", "CAT", "NDA", "CLAT"];

    if !valid_exams.contains(&exam_type_upper.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Invalid exam type".into()));
    }

    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let cache_duration: u64 = 3600000; // 1 hour

    {
        let cache_lock = cache.lock().await;
        if let Some(entry) = cache_lock.get(&exam_type_upper) {
            if current_time - entry.timestamp < cache_duration {
                return Ok(Json(serde_json::json!({
                    "news": entry.data,
                    "cached": true
                })));
            }
        }
    }

    let api_key = env::var("GEMINI_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "News service not configured".into()));
    }

    let prompt = format!(
        r#"System Instructions: You are an educational news curator specializing in competitive exams in India.
        User Request: Generate 5 recent and relevant news updates for {} exam aspirants.
        Include:
        - Exam date announcements
        - Syllabus changes
        - Important notifications
        - Study tips
        - Success stories or motivational updates

        Return EXACTLY as a JSON array with no markdown formatting:
        [
          {{
            "title": "News headline",
            "content": "Brief description (2-3 sentences)",
            "category": "announcement",
            "date": "YYYY-MM-DD",
            "source": "Official source or general"
          }}
        ]

        Make it realistic and helpful for current {} aspirants."#,
        exam_type_upper, exam_type_upper
    );

    let request_body = GeminiRequest {
        contents: vec![GeminiContent {
            role: "user".to_string(),
            parts: vec![GeminiPart { text: prompt }],
        }],
        generation_config: GeminiGenerationConfig {
            temperature: 0.7,
            max_output_tokens: 1500,
        },
    };

    let client = Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
        api_key
    );

    let res = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Gemini API Error: {}", err_text)));
    }

    let gemini_res: GeminiResponse = res
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response_text = gemini_res
        .candidates
        .and_then(|mut c| c.pop())
        .map(|c| c.content.parts.into_iter().map(|p| p.text).collect::<Vec<_>>().join(""))
        .unwrap_or_default();

    let start_idx = response_text.find('[');
    let end_idx = response_text.rfind(']');

    if let (Some(start), Some(end)) = (start_idx, end_idx) {
        let json_str = &response_text[start..=end];
        match serde_json::from_str::<serde_json::Value>(json_str) {
            Ok(parsed_news) => {
                let mut cache_lock = cache.lock().await;
                cache_lock.insert(
                    exam_type_upper.clone(),
                    CacheEntry {
                        data: parsed_news.clone(),
                        timestamp: current_time,
                    },
                );
                Ok(Json(serde_json::json!({ "news": parsed_news, "cached": false })))
            }
            Err(_) => Err((StatusCode::INTERNAL_SERVER_ERROR, "Failed to parse news response".into())),
        }
    } else {
        Err((StatusCode::INTERNAL_SERVER_ERROR, "Failed to extract JSON from response".into()))
    }
}

async fn get_dates(
    Path(exam_type): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let exam_type_upper = exam_type.to_uppercase();

    let api_key = env::var("GEMINI_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Service not configured".into()));
    }

    let prompt = format!(
        r#"System Instructions: You are an expert on Indian competitive exam schedules and timelines.
        User Request: Provide important dates for {} exam for the current academic year.

        Return EXACTLY as a JSON object with no markdown formatting:
        {{
          "examName": "{}",
          "dates": [
            {{
              "event": "Event name",
              "date": "YYYY-MM-DD",
              "description": "Brief description"
            }}
          ]
        }}

        Include: Registration dates, exam dates, result dates, counseling dates."#,
        exam_type_upper, exam_type_upper
    );

    let request_body = GeminiRequest {
        contents: vec![GeminiContent {
            role: "user".to_string(),
            parts: vec![GeminiPart { text: prompt }],
        }],
        generation_config: GeminiGenerationConfig {
            temperature: 0.5,
            max_output_tokens: 1000,
        },
    };

    let client = Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
        api_key
    );

    let res = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Gemini API Error: {}", err_text)));
    }

    let gemini_res: GeminiResponse = res
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response_text = gemini_res
        .candidates
        .and_then(|mut c| c.pop())
        .map(|c| c.content.parts.into_iter().map(|p| p.text).collect::<Vec<_>>().join(""))
        .unwrap_or_default();

    let start_idx = response_text.find('{');
    let end_idx = response_text.rfind('}');

    if let (Some(start), Some(end)) = (start_idx, end_idx) {
        let json_str = &response_text[start..=end];
        match serde_json::from_str::<serde_json::Value>(json_str) {
            Ok(parsed_dates) => Ok(Json(parsed_dates)),
            Err(_) => Err((StatusCode::INTERNAL_SERVER_ERROR, "Failed to parse dates response".into())),
        }
    } else {
        Err((StatusCode::INTERNAL_SERVER_ERROR, "Failed to extract JSON from response".into()))
    }
}

async fn clear_cache(
    State(cache): State<NewsCache>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut cache_lock = cache.lock().await;
    cache_lock.clear();
    Ok(Json(serde_json::json!({ "success": true, "message": "News cache cleared" })))
}