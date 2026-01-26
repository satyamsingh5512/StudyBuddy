# 🗄️ Database Architecture - MongoDB Only

## ✅ Current Setup: MongoDB Native Driver

This application uses **ONLY MongoDB** as its database. There is no Prisma ORM, no secondary databases, and no other data stores (except optional Redis for caching).

---

## 📊 Database Stack

```
┌─────────────────────────────────────┐
│         Application Layer           │
│    (Express + Socket.IO)            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      MongoDB Native Driver          │
│    (Direct Connection)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       MongoDB Atlas                 │
│    (Cloud Database)                 │
│                                     │
│  Collections:                       │
│  - users                            │
│  - chat_messages                    │
│  - sessions                         │
│  - todos                            │
│  - friendships                      │
│  - blocks                           │
│  - schedules                        │
│  - etc.                             │
└─────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### Connection Layer
**File**: `server/lib/mongodb.ts`

```typescript
// Single MongoDB connection pool
// Reused across all requests
// No Prisma, no ORM
import { MongoClient } from 'mongodb';

const client = new MongoClient(MONGODB_URI);
const db = client.db('studybuddy');
```

### Abstraction Layer
**File**: `server/lib/db.ts`

```typescript
// MongoDB abstraction layer
// Provides Prisma-like API for compatibility
// But uses MongoDB native driver underneath

export const db = {
  user: createModel('users'),
  chatMessage: createModel('chat_messages'),
  session: createModel('sessions'),
  // ... etc
};
```

**Key Points**:
- ✅ Direct MongoDB queries
- ✅ No ORM overhead
- ✅ Native MongoDB features
- ✅ Single connection pool
- ✅ Optimized for performance

---

## 📁 MongoDB Collections

### Core Collections

1. **users**
   - User accounts
   - Authentication data
   - Profile information
   - Settings

2. **sessions**
   - Express sessions
   - Login state
   - Session cookies

3. **chat_messages**
   - Community chat messages
   - Real-time messaging
   - Message history

4. **friendships**
   - Friend connections
   - Friend requests
   - Friendship status

5. **blocks**
   - Blocked users
   - Block reasons

6. **direct_messages**
   - Private messages
   - One-on-one chat

7. **todos**
   - User tasks
   - Task status

8. **schedules**
   - Study schedules
   - Time blocks

9. **dailyReports**
   - Daily progress
   - Study reports

10. **timerSessions**
    - Study timer data
    - Session tracking

---

## 🚫 What We DON'T Use

### ❌ Prisma ORM
- **Not used** in this application
- Some legacy references may exist in code
- All database operations use MongoDB native driver

### ❌ PostgreSQL / CockroachDB
- **Not used** - Migrated to MongoDB
- No SQL databases in this stack

### ❌ Secondary Databases
- **Not used** - Single MongoDB instance
- No database replication in app code
- (MongoDB Atlas handles replication internally)

### ❌ Multiple Database Connections
- **Not used** - Single connection pool
- One MongoDB URI
- One database: `studybuddy`

---

## 🔌 Connection Configuration

### Environment Variable
```bash
# Single MongoDB connection string
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/studybuddy
```

### Connection Options
```typescript
{
  retryWrites: true,
  w: 'majority',
  // Single connection pool
  // Reused across all requests
}
```

---

## 📊 Data Flow

### Write Operation
```
Client Request
    ↓
Express Route
    ↓
db.collection.create()
    ↓
MongoDB Native Driver
    ↓
MongoDB Atlas
```

### Read Operation
```
Client Request
    ↓
Express Route
    ↓
db.collection.findMany()
    ↓
MongoDB Native Driver
    ↓
MongoDB Atlas
    ↓
Return Data
```

### Real-time (Socket.IO)
```
Client Socket Event
    ↓
Socket.IO Handler
    ↓
Redis Cache (optional)
    ↓
MongoDB (batch write)
```

---

## 🚀 Performance Optimizations

### 1. Single Connection Pool
- ✅ One connection reused
- ✅ No connection overhead
- ✅ Faster queries

### 2. Indexes
- ✅ Automatic index creation
- ✅ Optimized queries
- ✅ Fast lookups

### 3. Selective Projection
- ✅ Only fetch needed fields
- ✅ Reduced data transfer
- ✅ Faster responses

### 4. Batch Operations
- ✅ Bulk inserts
- ✅ Batch updates
- ✅ Reduced round trips

### 5. Redis Caching (Optional)
- ✅ Cache hot data
- ✅ Reduce DB load
- ✅ Faster reads

---

## 🔒 Session Management

### MongoDB Session Store
```typescript
import MongoStore from 'connect-mongo';

const sessionStore = MongoStore.create({
  mongoUrl: MONGODB_URI,
  ttl: 30 * 24 * 60 * 60, // 30 days
  touchAfter: 24 * 3600,
  autoRemove: 'native',
});
```

**Benefits**:
- ✅ Sessions in MongoDB
- ✅ Automatic cleanup
- ✅ Persistent sessions
- ✅ No separate session store needed

---

## 📈 Scalability

### Current Setup
- **Database**: MongoDB Atlas (Free tier)
- **Storage**: 512MB
- **Connections**: Shared
- **Performance**: Good for development

### Production Recommendations
- **Upgrade**: M10 cluster ($57/month)
- **Storage**: 10GB+
- **Connections**: Dedicated
- **Performance**: Excellent

### Horizontal Scaling
- ✅ MongoDB Atlas handles replication
- ✅ Automatic failover
- ✅ Read replicas available
- ✅ Sharding available (if needed)

---

## 🔧 Deployment Configuration

### Render (Backend)
```bash
# Single environment variable
MONGODB_URI=mongodb+srv://...
```

### MongoDB Atlas
```bash
# Whitelist Render IP
Network Access → Add IP: 0.0.0.0/0
```

### No Additional Setup
- ❌ No Prisma migrations
- ❌ No schema sync
- ❌ No ORM configuration
- ✅ Just connect and go!

---

## 🧪 Testing Database Connection

### Health Check
```bash
curl https://your-app.onrender.com/api/health
```

### MongoDB Connection Test
```typescript
// Automatic on server start
const db = await getMongoDb();
if (db) {
  console.log('✅ MongoDB connected');
}
```

---

## 📊 Monitoring

### MongoDB Atlas Dashboard
- Connection count
- Query performance
- Storage usage
- Index usage
- Slow queries

### Application Logs
```bash
# Render Dashboard → Logs
✅ MongoDB connected
📊 Database: MongoDB (Native Driver)
```

---

## 🔄 Migration History

### Previous Setup (Deprecated)
- ❌ Prisma ORM
- ❌ CockroachDB/PostgreSQL
- ❌ Complex schema management

### Current Setup (Active)
- ✅ MongoDB Native Driver
- ✅ Direct queries
- ✅ Simple and fast
- ✅ No ORM overhead

---

## 📚 Code References

### Main Files
```
server/lib/mongodb.ts    - MongoDB connection
server/lib/db.ts         - Database abstraction
server/index.ts          - Session store setup
```

### Usage Example
```typescript
import { db } from './lib/db';

// Create
await db.user.create({ data: { ... } });

// Read
await db.user.findMany({ where: { ... } });

// Update
await db.user.update({ where: { ... }, data: { ... } });

// Delete
await db.user.delete({ where: { ... } });
```

---

## ✅ Summary

**Database**: MongoDB Atlas (Cloud)  
**Driver**: MongoDB Native Driver  
**ORM**: None (Direct queries)  
**Connection**: Single pool  
**Session Store**: MongoDB  
**Cache**: Redis (optional)  

**Architecture**: Simple, fast, scalable  
**Deployment**: Easy (just one connection string)  
**Maintenance**: Low (no migrations, no schema sync)  

---

**This is a clean, simple, MongoDB-only architecture!** 🎉

No Prisma, no secondary databases, no complexity - just MongoDB and your app!

---

**Last Updated**: January 26, 2026  
**Database**: MongoDB Only  
**Status**: ✅ Production Ready
