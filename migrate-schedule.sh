#!/bin/bash

echo "🔄 Migrating Schedule Feature to Database"
echo "=========================================="
echo ""

echo "Step 1: Generating Prisma Client..."
npm run db:generate

echo ""
echo "Step 2: Creating Database Migration..."
npx prisma migrate dev --name add_schedule_model

echo ""
echo "✅ Migration Complete!"
echo ""
echo "📝 Note: Restart your development server with 'npm run dev'"
echo ""
echo "🎉 The new schedule feature is ready to use!"
echo "   - View schedules by date"
echo "   - List view for better mobile experience"
echo "   - Mark tasks as complete"
echo "   - View past schedules"
