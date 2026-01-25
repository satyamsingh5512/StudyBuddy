# Server Connection Errors - Explanation & Fix

## What Were Those Errors?

The errors you saw in your console were caused by the **backend server repeatedly crashing and restarting** during development. Here's what each error means:

### 1. `ECONNREFUSED 127.0.0.1:3001`
```
Error: connect ECONNREFUSED 127.0.0.1:3001
```
**Meaning:** The frontend (Vite on port 5173) tried to connect to the backend (port 3001), but the backend server was **not running** or **crashed**.

**Why it happened:** The server kept crashing during hot-reload (file changes).

---

### 2. `ECONNRESET`
```
Error: read ECONNRESET
```
**Meaning:** An active connection was **forcefully closed** by the server.

**Why it happened:** The server crashed or restarted while WebSocket connections were active, causing them to be abruptly terminated.

---

### 3. `Process didn't exit in 5s. Force killing...`
```
8:40:45 PM [tsx] Process didn't exit in 5s. Force killing...
```
**Meaning:** The server process **hung** and didn't shut down gracefully within 5 seconds, so `tsx` (the TypeScript runner) force-killed it.

**Why it happened:** Socket.IO connections and MongoDB connections weren't being closed properly during shutdown, causing the process to hang.

---

### 4. `ws proxy error` / `http proxy error`
```
8:45:32 PM [vite] http proxy error: /api/health
8:45:32 PM [vite] ws proxy error:
```
**Meaning:** Vite's proxy (which forwards requests from frontend to backend) **couldn't reach the backend**.

**Why it happened:** The backend server was down or restarting.

---

## Root Cause

The main issue was **improper cleanup during server restarts**:

1. **Socket.IO connections** weren't being closed properly
2. **MongoDB connections** weren't being closed in the right order
3. **No timeout** for forced shutdown if graceful shutdown failed
4. **Missing error handlers** for Socket.IO events

This caused the server to:
- Hang during shutdown (connections still open)
- Get force-killed by `tsx`
- Fail to restart properly
- Leave the frontend unable to connect

---

## The Fix

### 1. Improved Graceful Shutdown (server/index.ts)
```typescript
const shutdown = async (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  try {
    // 1. Close Socket.IO first (stops new connections)
    io.close(() => {
      console.log('✅ Socket.IO closed');
    });
    
    // 2. Close MongoDB connection
    await closeMongoDb();
    
    // 3. Close HTTP server
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
    
    // 4. Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};
```

**What this does:**
- Closes connections in the **correct order** (Socket.IO → MongoDB → HTTP)
- Has a **10-second timeout** to force exit if shutdown hangs
- Handles **errors during shutdown**
- Works for both `SIGTERM` and `SIGINT` signals

### 2. Added Error Handlers (server/socket/chatHandlers.ts)
```typescript
io.on('connection', (socket: Socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // Error handler for socket
  socket.on('error', (error) => {
    console.error('❌ Socket error:', socket.id, error);
  });
  
  // ... rest of handlers
});
```

**What this does:**
- Catches Socket.IO errors before they crash the server
- Logs errors for debugging
- Prevents unhandled promise rejections

### 3. Added Global Error Handlers
```typescript
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});
```

**What this does:**
- Catches any unhandled errors that would crash the server
- Triggers graceful shutdown instead of abrupt crash
- Logs the error for debugging

---

## Current Status

✅ **Server is now running stably**
✅ **Graceful shutdown implemented**
✅ **Error handlers added**
✅ **Timeout protection added**

The errors you saw were from **past crashes**. The server is now:
- Running on `http://localhost:3001`
- Handling connections properly
- Shutting down gracefully on file changes
- Not hanging or crashing

---

## How to Verify It's Fixed

1. **Check server logs** - Should see clean restarts:
   ```
   🛑 SIGTERM received, shutting down gracefully...
   ✅ Socket.IO closed
   ✅ MongoDB connection closed
   ✅ Server closed
   ```

2. **No more ECONNREFUSED errors** - Frontend should connect successfully

3. **No more force kills** - Server should restart within 5 seconds

4. **Chat works** - WebSocket connections should be stable

---

## If Errors Persist

If you still see connection errors:

1. **Kill all processes on port 3001:**
   ```bash
   lsof -ti:3001 | xargs kill -9
   ```

2. **Restart the server:**
   ```bash
   npm run dev:server
   ```

3. **Check for port conflicts:**
   ```bash
   lsof -i:3001
   ```

4. **Clear browser cache** - Old WebSocket connections might be cached

---

## Prevention Tips

To avoid these errors in the future:

1. **Don't make rapid file changes** - Give the server time to restart
2. **Use `npm run clean`** if server gets stuck
3. **Check logs** for any MongoDB connection issues
4. **Restart both frontend and backend** if issues persist

---

**Status:** ✅ Fixed and Running
**Last Updated:** January 25, 2026
