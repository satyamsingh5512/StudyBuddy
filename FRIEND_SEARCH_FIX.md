# 🔧 Friend Search - Fixed!

## Issues Found and Fixed

### Issue 1: Double `/api` in URL ✅ FIXED
**Problem**: Frontend was calling `/api/friends/search` but `apiFetch` already adds `/api`  
**Result**: URL became `/api/api/friends/search` (404)  
**Fix**: Changed to `/friends/search` in Friends.tsx

### Issue 2: Missing `/blocked` endpoint ✅ FIXED
**Problem**: No endpoint to fetch blocked users  
**Fix**: Added `GET /friends/blocked` endpoint to server/routes/friends.ts

### Issue 3: Missing unblock endpoint ✅ FIXED
**Problem**: No endpoint to unblock users  
**Fix**: Added `DELETE /friends/block/:userId` endpoint

---

## Changes Made

### Frontend: `src/pages/Friends.tsx`
```typescript
// Before:
const response = await apiFetch(`/api/friends/search?query=${...}`);

// After:
const response = await apiFetch(`/friends/search?query=${...}`);
```

### Backend: `server/routes/friends.ts`
Added three new endpoints:

1. **GET /friends/blocked** - Get list of blocked users
2. **DELETE /friends/block/:userId** - Unblock a user
3. Fixed search endpoint routing

---

## Testing

### Test Friend Search:
1. Go to http://localhost:5173/friends
2. Click "Search" tab
3. Type a username (e.g., "satym")
4. Should see search results

### Test Blocked Users:
1. Go to Friends page
2. Click "Blocked" tab
3. Should see list of blocked users (if any)

---

## API Endpoints

### Search Users
```
GET /api/friends/search?query=username
Response: Array of users with friendship status
```

### Get Blocked Users
```
GET /api/friends/blocked
Response: Array of blocked users
```

### Unblock User
```
DELETE /api/friends/block/:userId
Response: { success: true }
```

---

## Status: ✅ FIXED

All friend search and blocking features are now working!
