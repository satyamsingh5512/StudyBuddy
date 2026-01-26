# Database Scripts

## Cleanup Database

Deletes all data from MongoDB collections for a fresh start.

### Usage

```bash
npm run db:cleanup
```

### What it does

- Connects to your MongoDB database (using MONGODB_URI from .env)
- Deletes all documents from all collections:
  - users
  - sessions
  - todos
  - daily_reports
  - schedules
  - timer_sessions
  - notices
  - faqs
  - friendships
  - blocks
  - direct_messages
  - chat_messages
  - videos
  - schools, colleges, coachings
  - school_messages, college_messages, coaching_messages

### ⚠️ Warning

**This action is irreversible!** All user data will be permanently deleted.

Use this when:
- Starting fresh in development
- Clearing test data
- Resetting the database after major schema changes

### Safety

The script:
- ✅ Only deletes documents (doesn't drop collections)
- ✅ Preserves indexes
- ✅ Shows detailed output of what was deleted
- ✅ Handles missing collections gracefully

### Example Output

```
🧹 Starting database cleanup...

📋 Collections to clean:
   - users
   - sessions
   - todos
   ...

✅ users                      - Deleted 5 documents
✅ sessions                   - Deleted 3 documents
✅ todos                      - Deleted 12 documents
⚠️  videos                    - Collection doesn't exist (skipped)
...

✨ Database cleanup completed successfully!
📊 All user data has been removed.
🔄 You can now start fresh with new signups.
```

### Troubleshooting

**Error: Failed to connect to database**
- Check your MONGODB_URI in .env file
- Verify MongoDB Atlas is accessible
- Check IP whitelist in MongoDB Atlas

**Error: Authentication failed**
- Verify MongoDB credentials
- Check database user permissions
