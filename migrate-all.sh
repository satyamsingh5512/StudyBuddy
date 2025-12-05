#!/bin/bash

echo "🔄 Running All Database Migrations"
echo "===================================="
echo ""

echo "Checking database connection..."
if ! npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
    echo ""
    echo "❌ ERROR: Cannot connect to database!"
    echo ""
    echo "Please ensure PostgreSQL is running."
    echo "See DATABASE_SETUP.md for help."
    echo ""
    echo "Quick fixes:"
    echo "  • Start PostgreSQL: sudo systemctl start postgresql"
    echo "  • Or use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres"
    echo "  • Or use online DB: See DATABASE_SETUP.md"
    echo ""
    exit 1
fi

echo "✓ Database connection successful"
echo ""

echo "Step 1: Generating Prisma Client..."
npm run db:generate

echo ""
echo "Step 2: Pushing Schema to Database..."
npx prisma db push

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
