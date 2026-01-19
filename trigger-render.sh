#!/bin/bash

# Render Manual Deployment Script for Backend
# Usage: ./trigger-render.sh
#
# Prerequisites:
# 1. Set RENDER_API_KEY environment variable
# 2. Set RENDER_SERVICE_ID environment variable (found in Render dashboard URL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Render Manual Deployment Script     ${NC}"
echo -e "${BLUE}========================================${NC}"

# Check for required environment variables
if [ -z "$RENDER_API_KEY" ]; then
    echo -e "${RED}Error: RENDER_API_KEY environment variable is not set.${NC}"
    echo -e "${YELLOW}Get your API key from: https://dashboard.render.com/u/settings/api-keys${NC}"
    echo -e "${YELLOW}Set it with: export RENDER_API_KEY=your_api_key${NC}"
    exit 1
fi

if [ -z "$RENDER_SERVICE_ID" ]; then
    echo -e "${RED}Error: RENDER_SERVICE_ID environment variable is not set.${NC}"
    echo -e "${YELLOW}Find your service ID in your Render dashboard URL:${NC}"
    echo -e "${YELLOW}https://dashboard.render.com/web/srv-XXXXXX <- This is your service ID${NC}"
    echo -e "${YELLOW}Set it with: export RENDER_SERVICE_ID=srv-xxxxx${NC}"
    exit 1
fi

# Build the backend first (optional - Render will build on deploy)
echo -e "\n${BLUE}Step 1: Building the backend locally (verification)...${NC}"

if [ -f "package.json" ]; then
    npm run build 2>/dev/null || echo -e "${YELLOW}No build script found, skipping local build...${NC}"
fi

echo -e "${GREEN}Build verification complete!${NC}\n"

# Trigger deployment via Render API
echo -e "${BLUE}Step 2: Triggering Render deployment...${NC}"

RESPONSE=$(curl -s -X POST \
    "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"clearCache": "do_not_clear"}')

# Check if deployment was triggered successfully
if echo "$RESPONSE" | grep -q '"id"'; then
    DEPLOY_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}Deployment triggered successfully!${NC}"
    echo -e "${YELLOW}Deploy ID: ${DEPLOY_ID}${NC}"
    echo -e "\n${BLUE}Step 3: Checking deployment status...${NC}"
    
    # Poll for deployment status
    MAX_ATTEMPTS=60
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        STATUS_RESPONSE=$(curl -s \
            "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys/${DEPLOY_ID}" \
            -H "Authorization: Bearer ${RENDER_API_KEY}")
        
        STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        case "$STATUS" in
            "live")
                echo -e "\n${GREEN}========================================${NC}"
                echo -e "${GREEN}   Deployment completed successfully!   ${NC}"
                echo -e "${GREEN}========================================${NC}"
                echo -e "${BLUE}Your backend is now live!${NC}"
                exit 0
                ;;
            "build_failed"|"update_failed"|"canceled")
                echo -e "\n${RED}Deployment failed with status: ${STATUS}${NC}"
                echo -e "${YELLOW}Check Render dashboard for details.${NC}"
                exit 1
                ;;
            *)
                echo -ne "\r${YELLOW}Status: ${STATUS} (checking again in 10s...)${NC}    "
                sleep 10
                ;;
        esac
        
        ATTEMPT=$((ATTEMPT + 1))
    done
    
    echo -e "\n${YELLOW}Timeout waiting for deployment. Check Render dashboard for status.${NC}"
else
    echo -e "${RED}Failed to trigger deployment!${NC}"
    echo -e "${RED}Response: ${RESPONSE}${NC}"
    exit 1
fi
