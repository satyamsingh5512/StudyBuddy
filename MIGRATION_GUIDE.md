# Database Migration Guide

## Quick Start

Run this single command to apply all database changes:

```bash
./migrate-all.sh
```

Then restart your development server:

```bash
npm run dev
```

## What Gets Migrated

This will create/update the following database tables:

### Schedule Table
- Weekly schedule with grid layout
- Date-based filtering
- Time slots (8 AM - 10 PM)
- Task titles and notes

### Friendship Table
- Friend requests (pending/accepted/rejected)
- Friend connections between users
- Timestamps for tracking

### DirectMessage Table
- Private one-on-one messaging
- Read receipts
- Message history

### Block Table
- User blocking functionality
- Block reasons (optional)

## Individual Migrations

If you prefer to run migrations separately:

### Schedule Only
```bash
./migrate-schedule.sh
```

### Friends Only
```bash
./migrate-friends.sh
```

## Troubleshooting

### Error: "Migration failed"
1. Check your DATABASE_URL in .env file
2. Ensure PostgreSQL is running
3. Check database connection

### Error: "Table already exists"
This is normal if you've run migrations before. The system will skip existing tables.

### Error: "Permission denied"
Make scripts executable:
```bash
chmod +x migrate-*.sh
```

## After Migration

1. Restart your development server
2. Clear browser cache (Ctrl+Shift+R)
3. Check browser console for any errors
4. Try creating a schedule entry

## Database Reset (Use with Caution!)

To reset the entire database:
```bash
npx prisma migrate reset
```

⚠️ **Warning**: This will delete ALL data!

## Verify Migration

Check if tables were created:
```bash
npx prisma studio
```

This opens a GUI to view your database tables.
