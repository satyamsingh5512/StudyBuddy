#!/bin/bash

# ============================================
# StudyBuddy Backend Keep-Alive Script
# ============================================
# This script pings your backend to prevent
# Render free tier from spinning down
# ============================================

# Configuration
BACKEND_URL="https://YOUR-APP-NAME.onrender.com/api/health"
LOG_FILE="$HOME/studybuddy-keepalive.log"
MAX_LOG_SIZE=10485760  # 10MB

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to rotate log if too large
rotate_log() {
    if [ -f "$LOG_FILE" ]; then
        size=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null)
        if [ "$size" -gt "$MAX_LOG_SIZE" ]; then
            mv "$LOG_FILE" "$LOG_FILE.old"
            log "Log rotated (size: $size bytes)"
        fi
    fi
}

# Main execution
main() {
    rotate_log
    
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "🔄 Keep-Alive Ping Started"
    log "🎯 Target: $BACKEND_URL"
    
    # Ping the backend with timeout
    response=$(curl -s -o /dev/null -w "%{http_code}" -m 30 "$BACKEND_URL" 2>&1)
    curl_exit=$?
    
    if [ $curl_exit -eq 0 ] && [ "$response" = "200" ]; then
        log "✅ Backend is alive (HTTP $response)"
        echo -e "${GREEN}✅ Backend is alive${NC}"
        exit 0
    else
        log "❌ Backend check failed (HTTP $response, exit code: $curl_exit)"
        echo -e "${RED}❌ Backend check failed${NC}"
        exit 1
    fi
}

# Run main function
main
