#!/bin/bash

# Vercel Manual Deployment Script
# Usage: ./trigger-vercel.sh [production|preview]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Vercel Manual Deployment Script     ${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI is not installed.${NC}"
    echo -e "${YELLOW}Install it with: npm install -g vercel${NC}"
    exit 1
fi

# Determine deployment type
DEPLOY_TYPE="${1:-preview}"

echo -e "\n${YELLOW}Deployment type: ${DEPLOY_TYPE}${NC}\n"

# Run build first
echo -e "${BLUE}Step 1: Building the project...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed! Aborting deployment.${NC}"
    exit 1
fi

echo -e "${GREEN}Build successful!${NC}\n"

# Deploy to Vercel
echo -e "${BLUE}Step 2: Deploying to Vercel...${NC}"

if [ "$DEPLOY_TYPE" == "production" ]; then
    echo -e "${YELLOW}Deploying to PRODUCTION...${NC}"
    vercel --prod
else
    echo -e "${YELLOW}Deploying PREVIEW...${NC}"
    vercel
fi

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}   Deployment completed successfully!   ${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "\n${RED}Deployment failed!${NC}"
    exit 1
fi
