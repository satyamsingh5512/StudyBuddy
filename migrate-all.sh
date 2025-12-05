#!/bin/bash

echo "🔄 Running All Database Migrations"
echo "===================================="
echo ""

echo "Step 1: Generating Prisma Client..."
npm run db:generate

echo ""
echo "Step 2: Creating Database Migrations..."
npx prisma migrate dev --name add_all_features

echo ""
echo "✅ All Migrations Complete!"
echo ""
echo "📝 Note: Restart your development server with 'npm run dev'"
echo ""
echo "🎉 All features are ready to use!"
echo "   ✓ Schedule system with grid layout"
echo "   ✓ Friend system with search"
echo "   ✓ Private messaging"
echo "   ✓ Username validation"
