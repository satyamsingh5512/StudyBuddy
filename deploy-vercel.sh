#!/bin/bash

# Vercel Deployment Script for StudyBuddy Frontend

echo "🚀 StudyBuddy Vercel Deployment"
echo "================================"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

echo "📋 Pre-deployment Checklist:"
echo ""
echo "1. ✅ Have you set VITE_API_URL in Vercel dashboard?"
echo "   Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables"
echo "   Add: VITE_API_URL = https://your-render-app.onrender.com"
echo ""
echo "2. ✅ Have you added your Vercel URL to Render backend CORS?"
echo "   Go to: Render Dashboard → Your Service → Environment"
echo "   Add: FRONTEND_URL = https://your-vercel-app.vercel.app"
echo "   Add: ALLOWED_ORIGINS = https://your-vercel-app.vercel.app"
echo ""

read -p "Have you completed the checklist above? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please complete the checklist first!"
    echo "📖 See VERCEL_SETUP.md for detailed instructions"
    exit 1
fi

echo ""
echo "🔨 Building frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "✅ Build successful!"
echo ""
echo "🚀 Deploying to Vercel..."
echo ""

# Deploy to production
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Test your app at the Vercel URL"
echo "2. Check browser console for any CORS errors"
echo "3. Verify API calls are reaching your Render backend"
echo ""
echo "🔍 Troubleshooting:"
echo "- Check Render logs: https://dashboard.render.com"
echo "- Check Vercel logs: https://vercel.com/dashboard"
echo "- See VERCEL_SETUP.md for common issues"
