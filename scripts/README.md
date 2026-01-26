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


---

## Test Email Configuration

Tests SMTP email configuration and sends a test email.

### Usage

```bash
npm run test:email
```

### What it does

- Verifies all SMTP environment variables are set
- Tests connection to SMTP server
- Sends a test email with sample OTP
- Provides detailed diagnostics

### Environment Variables Required

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="StudyBuddy <your-email@gmail.com>"
```

### Example Output

```
🔍 Testing Email Configuration...

Environment Variables:
  SMTP_HOST: smtp.gmail.com
  SMTP_PORT: 587
  SMTP_SECURE: false
  SMTP_USER: ✅ Set
  SMTP_PASS: ✅ Set (hidden)
  EMAIL_FROM: StudyBuddy <email@gmail.com>

📧 Creating email transporter...
🔌 Verifying SMTP connection...
✅ SMTP connection successful!

📨 Sending test email to email@gmail.com...
✅ Test email sent successfully!
   Message ID: <abc123@gmail.com>

📬 Check your inbox: email@gmail.com
   (Check spam folder if not in inbox)
```

### Troubleshooting

**Error: SMTP credentials not configured**
- Add SMTP_USER and SMTP_PASS to .env file
- For Gmail, use App Password (not regular password)

**Error: SMTP connection failed**
- Verify SMTP credentials are correct
- Check if 2-Step Verification is enabled (required for App Passwords)
- Verify network/firewall allows port 587
- Try regenerating Gmail App Password

**Email sent but not received**
- Check spam/junk folder
- Check Gmail Promotions tab
- Search for "StudyBuddy" in Gmail
- Add sender to contacts

### Gmail App Password Setup

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to App passwords
4. Select Mail → Other (Custom name)
5. Enter "StudyBuddy"
6. Copy the 16-character password
7. Use as SMTP_PASS in .env

### See Also

- `EMAIL_TROUBLESHOOTING.md` - Detailed email troubleshooting guide
- `CHECK_EMAIL_DELIVERY.md` - How to verify email delivery
