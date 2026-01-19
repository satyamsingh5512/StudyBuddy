# Quick Start Guide - Dual Database

## For Developers: How to Use the New Architecture

### TL;DR

**Writing Data**:
```typescript
// ✅ CORRECT - Use transaction with outbox
await prisma.$transaction([
  prisma.todo.create({ data }),
  prisma.outbox.create({ 
    eventType: 'todo.created',
    aggregateType: 'todo',
    aggregateId: todo.id,
    payload: todo as any
  })
]);
```

**Reading Data**:
```typescript
// Critical reads → CockroachDB
const user = await prisma.user.findUnique({ where: { id } });

// Analytics → MongoDB
const stats = await queryMongo('dailyReports', { userId });
```

---

## Setup (First Time)

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Migration

```bash
npx prisma generate
npx prisma migrate dev
```

### 3. Start Everything

```bash
# Terminal 1: Frontend
npm run dev:client

# Terminal 2: Backend API
npm run dev:server

# Terminal 3: Sync Worker
npm run dev:worker
```

### 4. Verify Setup

```bash
npm run verify:sync
```

---

## Writing Data (CREATE, UPDATE, DELETE)

### Rule: Always use `prisma.$transaction()` with outbox event

### Example 1: Create Todo

```typescript
import { prisma } from '../lib/prisma';

router.post('/todos', async (req, res) => {
  const userId = (req.user as any).id;
  
  // ✅ CORRECT
  const todo = await prisma.$transaction(async (tx) => {
    // 1. Create todo
    const newTodo = await tx.todo.create({
      data: { ...req.body, userId },
    });

    // 2. Create outbox event (same transaction)
    await tx.outbox.create({
      data: {
        eventType: 'todo.created',
        aggregateType: 'todo',
        aggregateId: newTodo.id,
        payload: newTodo as any,
      },
    });

    return newTodo;
  });

  res.json(todo);
});
```

### Example 2: Update User

```typescript
router.patch('/users/:id', async (req, res) => {
  // ✅ CORRECT
  const user = await prisma.$transaction(async (tx) => {
    // 1. Update user
    const updated = await tx.user.update({
      where: { id: req.params.id },
      data: req.body,
    });

    // 2. Create outbox event
    await tx.outbox.create({
      data: {
        eventType: 'user.updated',
        aggregateType: 'user',
        aggregateId: updated.id,
        payload: updated as any,
      },
    });

    return updated;
  });

  res.json(user);
});
```

### Example 3: Delete Message

```typescript
router.delete('/messages/:id', async (req, res) => {
  // ✅ CORRECT
  await prisma.$transaction(async (tx) => {
    // 1. Delete message
    await tx.directMessage.delete({
      where: { id: req.params.id },
    });

    // 2. Create outbox event
    await tx.outbox.create({
      data: {
        eventType: 'message.deleted',
        aggregateType: 'message',
        aggregateId: req.params.id,
        payload: { id: req.params.id } as any,
      },
    });
  });

  res.json({ success: true });
});
```

---

## Reading Data

### Rule: Use CockroachDB for critical reads, MongoDB for analytics

### CockroachDB (Prisma) - Use For:

✅ Authentication
✅ Authorization
✅ Read-after-write
✅ Transactional data
✅ Critical operations

```typescript
// Example: Get user profile
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    username: true,
    totalPoints: true,
  },
});
```

### MongoDB - Use For:

✅ Leaderboards
✅ Analytics
✅ Search
✅ Chat history
✅ Reports

```typescript
import { queryMongo, aggregateMongo } from '../lib/mongodb';

// Example: Leaderboard
const leaderboard = await queryMongo('users', 
  { showProfile: true },
  { 
    sort: { totalPoints: -1 }, 
    limit: 10,
    projection: { username: 1, totalPoints: 1, avatar: 1 }
  }
);

// Example: Study statistics
const stats = await aggregateMongo('dailyReports', [
  { $match: { userId } },
  { $group: {
      _id: null,
      totalHours: { $sum: '$studyHours' },
      avgCompletion: { $avg: '$completionPct' }
    }
  }
]);
```

---

## Common Patterns

### Pattern 1: Create with Related Data

```typescript
// Create user with initial todo
await prisma.$transaction(async (tx) => {
  // Create user
  const user = await tx.user.create({ data: userData });
  
  // Create outbox for user
  await tx.outbox.create({
    data: {
      eventType: 'user.created',
      aggregateType: 'user',
      aggregateId: user.id,
      payload: user as any,
    },
  });

  // Create initial todo
  const todo = await tx.todo.create({
    data: { ...todoData, userId: user.id },
  });

  // Create outbox for todo
  await tx.outbox.create({
    data: {
      eventType: 'todo.created',
      aggregateType: 'todo',
      aggregateId: todo.id,
      payload: todo as any,
    },
  });

  return { user, todo };
});
```

### Pattern 2: Update with Side Effects

```typescript
// Complete todo and award points
await prisma.$transaction(async (tx) => {
  // Update todo
  const todo = await tx.todo.update({
    where: { id: todoId },
    data: { completed: true },
  });

  await tx.outbox.create({
    data: {
      eventType: 'todo.updated',
      aggregateType: 'todo',
      aggregateId: todo.id,
      payload: todo as any,
    },
  });

  // Award points
  const user = await tx.user.update({
    where: { id: userId },
    data: { totalPoints: { increment: 1 } },
  });

  await tx.outbox.create({
    data: {
      eventType: 'user.updated',
      aggregateType: 'user',
      aggregateId: user.id,
      payload: user as any,
    },
  });

  return { todo, user };
});
```

### Pattern 3: Bulk Operations

```typescript
// Bulk create todos
await prisma.$transaction(async (tx) => {
  const todos = [];
  
  for (const todoData of todosToCreate) {
    const todo = await tx.todo.create({ data: todoData });
    todos.push(todo);

    await tx.outbox.create({
      data: {
        eventType: 'todo.created',
        aggregateType: 'todo',
        aggregateId: todo.id,
        payload: todo as any,
      },
    });
  }

  return todos;
});
```

---

## Testing

### Test Outbox Events Created

```typescript
import { prisma } from '../lib/prisma';

test('creates outbox event on todo creation', async () => {
  // Create todo
  const todo = await prisma.$transaction(async (tx) => {
    const newTodo = await tx.todo.create({ data: todoData });
    await tx.outbox.create({
      data: {
        eventType: 'todo.created',
        aggregateType: 'todo',
        aggregateId: newTodo.id,
        payload: newTodo as any,
      },
    });
    return newTodo;
  });

  // Verify outbox event exists
  const outboxEvent = await prisma.outbox.findFirst({
    where: {
      aggregateType: 'todo',
      aggregateId: todo.id,
    },
  });

  expect(outboxEvent).toBeTruthy();
  expect(outboxEvent.eventType).toBe('todo.created');
});
```

---

## Debugging

### Check Outbox Events

```bash
# Connect to database
psql $DATABASE_URL

# View recent events
SELECT * FROM "Outbox" ORDER BY created_at DESC LIMIT 10;

# View unprocessed events
SELECT * FROM "Outbox" WHERE processed = false;

# View failed events
SELECT * FROM "Outbox" WHERE retry_count > 5;
```

### Check MongoDB Sync

```bash
# Run verification
npm run verify:sync

# Check worker logs
pm2 logs sync-worker

# Check health
curl http://localhost:3001/api/health/sync
```

---

## Common Mistakes

### ❌ WRONG: Writing without transaction

```typescript
// ❌ DON'T DO THIS
const todo = await prisma.todo.create({ data });
await prisma.outbox.create({ data: event });
// Problem: Not atomic - can fail between calls
```

### ❌ WRONG: Forgetting outbox event

```typescript
// ❌ DON'T DO THIS
const todo = await prisma.todo.create({ data });
// Problem: Data won't sync to MongoDB
```

### ❌ WRONG: Reading from MongoDB immediately after write

```typescript
// ❌ DON'T DO THIS
await prisma.todo.create({ data });
const todos = await queryMongo('todos', { userId });
// Problem: MongoDB has 2-5s lag, won't see new todo
```

### ✅ CORRECT: Read from CockroachDB after write

```typescript
// ✅ DO THIS
await prisma.todo.create({ data });
const todos = await prisma.todo.findMany({ where: { userId } });
// Correct: CockroachDB has immediate consistency
```

---

## Event Types Reference

```typescript
// Users
'user.created'
'user.updated'
'user.deleted'

// Todos
'todo.created'
'todo.updated'
'todo.deleted'

// Messages
'message.created'
'message.deleted'

// Reports
'report.created'

// Sessions
'session.created'

// Friendships
'friendship.created'
'friendship.updated'
'friendship.deleted'

// Forms
'form.created'
'form.updated'
'form.deleted'

// Responses
'response.created'
```

---

## Aggregate Types Reference

```typescript
'user'
'todo'
'message'
'report'
'session'
'friendship'
'form'
'response'
```

---

## Need Help?

1. **Check documentation**: `DUAL_DATABASE_ARCHITECTURE.md`
2. **Run verification**: `npm run verify:sync`
3. **Check health**: `curl /api/health/sync`
4. **View logs**: `pm2 logs sync-worker`
5. **Ask team**: #backend-help channel

---

## Quick Reference Card

```typescript
// ✅ WRITE PATTERN
await prisma.$transaction([
  prisma.MODEL.create({ data }),
  prisma.outbox.create({ 
    eventType: 'MODEL.created',
    aggregateType: 'MODEL',
    aggregateId: result.id,
    payload: result as any
  })
]);

// ✅ READ PATTERN (Critical)
await prisma.MODEL.findMany({ where });

// ✅ READ PATTERN (Analytics)
await queryMongo('collection', filter, options);
```

---

**Remember**: When in doubt, use CockroachDB (Prisma). MongoDB is for analytics only.
