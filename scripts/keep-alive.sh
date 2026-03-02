#!/bin/bash

# Configuration
SERVER_URL="https://studybuddy-api-s1bx.onrender.com/health"
LOG_FILE="keep-alive.log"

# Function to ping the server
ping_server() {
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL")
    echo "[$TIMESTAMP] Pinged $SERVER_URL - Status: $STATUS" >> "$LOG_FILE"
}

# Run the ping once
ping_server
