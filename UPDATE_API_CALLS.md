# Update API Calls - Quick Reference

All API calls need to use `apiFetch` from `@/config/api` instead of direct `fetch('/api/...`

## Files Already Updated
- ✅ src/App.tsx
- ✅ src/pages/Landing.tsx  
- ✅ src/components/Layout.tsx

## Files That Need Updating

### High Priority (Core Functionality)
1. **src/pages/Dashboard.tsx** - Todo list
2. **src/pages/Onboarding.tsx** - User setup
3. **src/pages/Chat.tsx** - Real-time chat

### Medium Priority
4. **src/pages/Reports.tsx** - Study reports
5. **src/pages/Leaderboard.tsx** - Rankings
6. **src/pages/Notices.tsx** - Notifications
7. **src/pages/Settings.tsx** - User settings

## How to Update

### Before:
```typescript
const res = await fetch('/api/todos', { credentials: 'include' });
```

### After:
```typescript
import { apiFetch } from '@/config/api';

const res = await apiFetch('/api/todos');
```

Note: `credentials: 'include'` is automatic in `apiFetch`

## Socket.io Connection

Also update Socket.io connection in Chat.tsx:

### Before:
```typescript
const socket = io();
```

### After:
```typescript
import { API_URL } from '@/config/api';

const socket = io(API_URL);
```

## For Now (Quick Fix)

Since you haven't deployed the backend yet, you can test locally:
1. Keep `VITE_API_URL=http://localhost:3001` in `.env`
2. Run backend: `npm run dev:server`
3. Run frontend: `npm run dev:client`
4. Test everything works locally first
5. Then deploy backend to Render
6. Update `VITE_API_URL` in Vercel to Render URL
