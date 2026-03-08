#!/bin/bash

# StudyBuddy Keepalive Script
# Pings the backend server every 3 minutes to prevent sleep

URL="https://studybuddy-go-backend.onrender.com/api/health"
LOG_FILE="/var/log/keepalive.log"

echo "$(date): Starting keepalive script" >> $LOG_FILE

while true; do
    echo "$(date): Pinging $URL" >> $LOG_FILE
    curl -s -o /dev/null -w "%{http_code}" "$URL" >> $LOG_FILE 2>&1
    echo "" >> $LOG_FILE
    sleep 180  # 3 minutes in seconds
done
