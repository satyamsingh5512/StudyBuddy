# Codebase Cleanup Plan

## Files to Remove

### 1. Duplicate/Unused API Folder (Vercel-specific)
**Folder**: `api/`
- `api/index.ts` - Vercel serverless function (not used with unified deployment)
- `api/lib/auth.ts` - Duplicate auth logic
- `api/lib/cache.ts` - Duplicate cache logic
- `api/lib/email.ts` - Duplicate email logic
- `api/lib/prisma.ts` - Duplicate Prisma client
- `api/tsconfig.json` - Vercel-specific config

**Reason**: We're using a unified Express server, not Vercel serverless functions

### 2. Optimized Files (Not Imported)
- `server/routes/messages.optimized.ts` - Not imported anywhere
- `server/routes/friends.optimized.ts` - Not imported anywhere
- `server/socket/handlers.optimized.ts` - Not imported anywhere

**Reason**: These are alternative implementations that aren't being used

### 3. Prisma Sync Infrastructure (Obsolete)
- `server/workers/syncWorker.ts` - Syncs Prisma to MongoDB (not needed)
- `server/utils/databaseSync.ts` - Prisma-MongoDB sync utilities
- `server/middleware/mongoSync.ts` - Sync middleware
- `scripts/verify-sync.ts` - Verification script

**Reason**: We're migrating to MongoDB-only, no need for dual-database sync

### 4. Keep-Alive Service (Already Removed from Use)
- `server/utils/keepAlive.ts` - Render-specific keep-alive

**Reason**: Already removed from server.ts, just cleaning up the file

### 5. Vercel Configuration (Not Using Vercel Serverless)
- `vercel.json` - Vercel-specific deployment config

**Reason**: Using unified deployment, not Vercel serverless functions

### 6. Prisma Files (After Migration Complete)
- `prisma/` folder - Schema and migrations
- `server/lib/prisma.ts` - Prisma client

**Status**: Keep for now until all routes are migrated to MongoDB

## Package.json Scripts to Remove

### Obsolete Scripts:
- `dev:worker` - Sync worker (not needed)
- `dev:full` - Includes worker (not needed)
- `start:worker` - Start sync worker
- `worker:sync` - Run sync worker
- `verify:sync` - Verify Prisma-MongoDB sync
- `db:generate` - Prisma generate (after migration)
- `db:push` - Prisma push (after migration)
- `db:migrate` - Prisma migrate (after migration)
- `db:migrate:deploy` - Prisma deploy (after migration)
- `db:studio` - Prisma studio (after migration)

## Dependencies to Remove (After Prisma Migration)

### After all routes migrated to MongoDB:
- `@prisma/client`
- `prisma`
- `@quixo3/prisma-session-store`

## Summary

### Immediate Cleanup (Safe to Remove Now):
- ✅ `api/` folder (entire directory)
- ✅ `*.optimized.ts` files
- ✅ `server/workers/syncWorker.ts`
- ✅ `server/utils/databaseSync.ts`
- ✅ `server/middleware/mongoSync.ts`
- ✅ `server/utils/keepAlive.ts`
- ✅ `scripts/verify-sync.ts`
- ✅ `vercel.json`
- ✅ Worker-related scripts from package.json

### Later Cleanup (After MongoDB Migration):
- ⏳ `prisma/` folder
- ⏳ `server/lib/prisma.ts`
- ⏳ Prisma dependencies
- ⏳ Prisma scripts

## Impact Analysis

### Files Removed: ~15 files
### Lines of Code Removed: ~3000+ lines
### Processes Removed: 1 (sync worker)
### Complexity Reduced: Significant

## Benefits

1. **Simpler Architecture**: No dual-database sync
2. **Fewer Processes**: No background worker needed
3. **Cleaner Codebase**: No duplicate code
4. **Easier Maintenance**: Less code to maintain
5. **Faster Development**: Less confusion about which files to use
