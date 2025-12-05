#!/bin/bash

echo "🔄 Migrating Friend System to Database"
echo "========================================"
echo ""

echo "Step 1: Generating Prisma Client..."
npm run db:generate

echo ""
echo "Step 2: Creating Database Migration..."
npx prisma migrate dev --name add_friend_system

echo ""
echo "✅ Migration Complete!"
echo ""
echo "📝 Note: Restart your development server with 'npm run dev'"
echo ""
echo "🎉 The friend system is ready to use!"
echo "   - Search users by username"
echo "   - Send/receive friend requests"
echo "   - Private messaging with friends"
echo "   - Unfriend and block users"
echo "   - Manage blocked users"
