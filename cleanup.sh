#!/bin/bash

echo "🧹 Cleaning up StudyBuddy project..."

# Kill any running dev servers
echo "Stopping any running dev servers..."
pkill -f "tsx watch server/index.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true

# Remove build artifacts
echo "Removing build directories..."
rm -rf dist dist-server

# Remove log files
echo "Removing log files..."
find . -name "*.log" -type f -delete
find . -name "npm-debug.log*" -type f -delete
find . -name "yarn-debug.log*" -type f -delete
find . -name "yarn-error.log*" -type f -delete

# Remove OS-specific files
echo "Removing OS-specific files..."
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete
find . -name "*.swp" -type f -delete
find . -name "*.swo" -type f -delete
find . -name "*~" -type f -delete

# Remove empty directories (except node_modules and .git)
echo "Removing empty directories..."
find . -type d -empty -not -path "./node_modules/*" -not -path "./.git/*" -delete 2>/dev/null || true

# Clear npm cache (optional)
if [ "$1" == "--deep" ]; then
  echo "Performing deep clean..."
  echo "Clearing npm cache..."
  npm cache clean --force
  echo "Removing node_modules..."
  rm -rf node_modules
  echo "Run 'npm install' to reinstall dependencies"
fi

echo "✅ Cleanup complete!"
echo ""
echo "Size of project:"
du -sh . 2>/dev/null | head -1
