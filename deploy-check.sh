#!/bin/bash

echo "🚀 StudyBuddy Deployment Readiness Check"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node version: $NODE_VERSION"
if [[ "$NODE_VERSION" < "v18" ]]; then
    echo -e "   ${RED}✗ Node.js 18+ required${NC}"
    exit 1
else
    echo -e "   ${GREEN}✓ Node.js version OK${NC}"
fi
echo ""

# Check if node_modules exists
echo "📦 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "   ${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "   ${YELLOW}⚠ Dependencies not installed${NC}"
    echo "   Run: npm install"
fi
echo ""

# Check if .env exists
echo "🔐 Checking environment variables..."
if [ -f ".env" ]; then
    echo -e "   ${GREEN}✓ .env file exists${NC}"
    
    # Check for required variables
    REQUIRED_VARS=("MONGODB_URI" "SESSION_SECRET" "GOOGLE_CLIENT_ID" "GROQ_API_KEY" "EMAIL_USER")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" .env; then
            echo -e "   ${GREEN}✓ $var set${NC}"
        else
            echo -e "   ${RED}✗ $var missing${NC}"
        fi
    done
else
    echo -e "   ${YELLOW}⚠ .env file not found${NC}"
    echo "   Copy .env.example to .env and fill in values"
fi
echo ""

# Test frontend build
echo "🏗️  Testing frontend build..."
if npm run build > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Frontend builds successfully${NC}"
    
    # Check dist folder
    if [ -d "dist" ]; then
        DIST_SIZE=$(du -sh dist | cut -f1)
        echo "   Build size: $DIST_SIZE"
    fi
else
    echo -e "   ${RED}✗ Frontend build failed${NC}"
    echo "   Run: npm run build"
    echo "   Check for TypeScript errors"
fi
echo ""

# Check vercel.json
echo "📄 Checking Vercel configuration..."
if [ -f "vercel.json" ]; then
    echo -e "   ${GREEN}✓ vercel.json exists${NC}"
else
    echo -e "   ${RED}✗ vercel.json missing${NC}"
fi
echo ""

# Check package.json scripts
echo "📜 Checking package.json scripts..."
if grep -q '"start:server"' package.json; then
    echo -e "   ${GREEN}✓ start:server script exists${NC}"
else
    echo -e "   ${RED}✗ start:server script missing${NC}"
fi
echo ""

# Summary
echo "========================================"
echo "📊 Deployment Readiness Summary"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Deploy backend to Render"
echo "   - Use: npm run start:server"
echo "   - Add all environment variables"
echo ""
echo "2. Deploy frontend to Vercel"
echo "   - Add VITE_API_URL environment variable"
echo "   - Use: npm run build"
echo ""
echo "3. Update OAuth callbacks"
echo "4. Test all features"
echo ""
echo "📚 See DEPLOYMENT_STEPS.md for detailed instructions"
echo "📋 See PRE_DEPLOYMENT_CHECKLIST.md for checklist"
echo ""
