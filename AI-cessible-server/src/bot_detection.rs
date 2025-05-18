use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use std::time::Instant;
use tracing::debug;

/// Bot detection middleware for HTTP requests
pub async fn bot_detection_middleware(
    request: Request,
    next: Next,
) -> Response {
    // Extract bot detection headers
    let bot_confidence = request
        .headers()
        .get("X-Bot-Confidence")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<f32>().ok())
        .unwrap_or(0.5);

    let agent_type = request
        .headers()
        .get("X-User-Agent-Type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    // Store in request extensions for use in the GraphQL resolvers
    let bot_info = BotInfo {
        confidence_score: bot_confidence,
        agent_type: agent_type.to_string(),
        request_start: Instant::now(),
    };

    // Log for debugging
    debug!(
        "Bot detection: path={}, confidence={}, agent_type={}, is_bot={}",
        request.uri().path(),
        bot_confidence, 
        agent_type,
        bot_info.is_likely_bot()
    );

    // Create a new request with bot info
    let mut modified_request = request;
    modified_request.extensions_mut().insert(bot_info);

    // Process request
    let response = next.run(modified_request).await;
    
    // Return response
    response
}

/// Information about bot detection for the current request
#[derive(Clone, Debug)]
pub struct BotInfo {
    pub confidence_score: f32,
    pub agent_type: String,
    pub request_start: Instant,
}

impl BotInfo {
    pub fn is_likely_bot(&self) -> bool {
        self.confidence_score >= 0.55 || self.agent_type == "bot"
    }
}

/// Route selection based on bot detection
pub fn should_use_bot_api(bot_info: &BotInfo) -> bool {
    // Use bot-specific endpoints if:
    // 1. Confidence score is high enough
    // 2. Client explicitly identifies as a bot
    
    // For this implementation, we'll use the is_likely_bot method
    bot_info.is_likely_bot()
} 