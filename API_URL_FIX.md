# API URL Double Prefix Fix ✅

## Issues Fixed

### 1. Double `/api/api/` in API Calls
**Problem**: Frontend was calling `/api/api/auth/me` instead of `/api/auth/me`

**Root Cause**: The `apiFetch()` helper already adds `/api` prefix, but code was passing paths like `/api/auth/me`, resulting in `/api/api/auth/me`.

**Solution**: Removed `/api` prefix from all `apiFetch()` calls throughout the codebase.

**Before**:
```typescript
apiFetch('/api/auth/me')  // Results in /api/api/auth/me ❌
```

**After**:
```typescript
apiFetch('/auth/me')  // Results in /api/auth/me ✅
```

### 2. Google OAuth Redirect Issue
**Problem**: After Google login, user was redirected back to landing page instead of dashboard.

**Root Cause**: The Google OAuth callback was redirecting to `CLIENT_URL` (root) instead of `/dashboard`.

**Solution**: Updated callback to redirect to `/dashboard` after successful authentication.

**Before**:
```typescript
res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
```

**After**:
```typescript
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
res.redirect(`${clientUrl}/dashboard`);
```

## Files Modified

### Automated Fix (sed script):
- All `*.ts` and `*.tsx` files in `src/` directory
- Replaced `apiFetch('/api/` with `apiFetch('/`
- Replaced `apiFetch("/api/` with `apiFetch("/`
- Replaced `` apiFetch(`/api/ `` with `` apiFetch(`/ ``

### Manual Fixes:
1. `src/App.tsx` - Fixed `/auth/me` call
2. `server/routes/auth.ts` - Fixed Google OAuth callback redirect

## Files Affected

**Frontend Components**:
- `src/components/Layout.tsx`
- `src/components/FullscreenTimer.tsx`
- `src/components/BuddyChat.tsx`
- `src/components/StudyTimer.tsx`

**Frontend Pages**:
- `src/pages/Dashboard.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/Notices.tsx`
- `src/pages/Leaderboard.tsx`
- `src/pages/Friends.tsx`
- `src/pages/Reports.tsx`

**Hooks**:
- `src/hooks/useOptimisticMutation.ts`

**Backend**:
- `server/routes/auth.ts`

## Testing

### Before Fix:
```
❌ GET /api/api/auth/me → 404 Not Found
❌ Google OAuth → Redirects to landing page
```

### After Fix:
```
✅ GET /api/auth/me → 200 OK
✅ Google OAuth → Redirects to /dashboard
```

## How API URLs Work Now

The `apiFetch()` helper in `src/config/api.ts` automatically adds `/api` prefix:

```typescript
export const API_URL = '/api';

export const apiFetch = (path: string, options?: RequestInit) => {
  return fetch(`${API_URL}${path}`, {  // Adds /api automatically
    credentials: 'include',
    ...options,
  });
};
```

**Usage**:
```typescript
// ✅ Correct
apiFetch('/auth/me')        // → /api/auth/me
apiFetch('/todos')          // → /api/todos
apiFetch('/users/profile')  // → /api/users/profile

// ❌ Wrong (creates double /api/)
apiFetch('/api/auth/me')    // → /api/api/auth/me
```

## Benefits

1. **Consistent API calls** - All endpoints use the same pattern
2. **No more 404 errors** - Correct URLs are generated
3. **Better UX** - Google OAuth works correctly
4. **Cleaner code** - No redundant `/api` prefixes

## Date
January 25, 2026
