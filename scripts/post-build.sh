#!/bin/bash
# Post-build script for Render deployment
# This runs after the build completes and before the server starts

echo "🔄 Running database migrations..."

# Only run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  npx prisma db push --accept-data-loss --skip-generate
  echo "✅ Database migrations complete"
else
  echo "⚠️  DATABASE_URL not set, skipping migrations"
fi
