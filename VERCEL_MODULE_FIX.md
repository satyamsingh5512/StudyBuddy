# Vercel ES Module Import Fix

## Problem
Vercel deployment failing with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/config/passport'
```

## Root Cause
ES modules (`"type": "module"`) require explicit `.js` extensions for all relative imports in production. TypeScript compiles `.ts` to `.js` but doesn't add extensions automatically.

## Solution
Add `.js` extensions to ALL relative imports in server-side TypeScript files.

### Files Fixed

**Core:**
- api/index.ts
- server/app.ts
- server/index.ts

**Middleware:**
- server/middleware/index.ts
- server/middleware/rateLimiting.ts

**Libraries:**
- server/lib/db.ts

**Configuration:**
- server/config/passport.ts

**All Routes:**
- server/routes/*.ts (16 files)

## Example

Before:
```typescript
import { db } from '../lib/db';
import { isAuthenticated } from '../middleware/auth';
```

After:
```typescript
import { db } from '../lib/db.js';
import { isAuthenticated } from '../middleware/auth.js';
```

## Important Notes

1. Only relative imports need `.js` extensions
2. Use `.js` even though source files are `.ts`
3. Required for Vercel/Node.js ES modules
4. Works locally without extensions (tsx handles it)
5. Check all new files follow this pattern

## Verification

```bash
npm run build
# Should succeed without errors
```

## Prevention

When creating new server files:
1. Always add `.js` to relative imports
2. Test with `npm run build` before deploying
3. Check Vercel logs if deployment fails

## Why This Happens

TypeScript doesn't automatically add `.js` extensions when compiling to ES modules. Node.js ES modules require explicit extensions. Vercel's serverless environment uses ES modules. Local development works because `tsx` handles resolution automatically.
