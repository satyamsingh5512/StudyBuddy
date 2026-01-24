# Email OTP Setup Guide

Complete guide to configure email-based OTP (One-Time Password) verification for StudyBuddy.

---

## 📧 Overview

The OTP system sends 6-digit verification codes via email for:
- **Email verification** during signup
- **Password reset** requests
- **Account security** verification

Currently, OTP codes are displayed in the server console. This guide will help you configure real email delivery.

---

## 🚀 Quick Setup (Gmail - Recommended)

### Step 1: Enable 2-Factor Authentication on Gmail

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** in the left sidebar
3. Under "Signing in to Google", click **2-Step Verification**
4. Follow the prompts to enable 2FA (you'll need your phone)

### Step 2: Generate App Password

1. After enabling 2FA, go back to **Security**
2. Under "Signing in to Google", click **App passwords**
   - If you don't see this option, make sure 2FA is enabled
3. Click **Select app** → Choose "Mail"
4. Click **Select device** → Choose "Other (Custom name)"
5. Enter "StudyBuddy" as the name
6. Click **Generate**
7. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)
   - ⚠️ Save this password - you won't see it again!

### Step 3: Update .env File

Open your `.env` file and update these lines:

```env
# SMTP Configuration (for email verification and password reset)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"          # ← Your Gmail address
SMTP_PASS="abcd efgh ijkl mnop"           # ← The 16-char app password (no spaces)
```

**Example:**
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="john.doe@gmail.com"
SMTP_PASS="abcdefghijklmnop"
```

### Step 4: Restart the Server

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev:server
```

### Step 5: Test It!

1. Go to `http://localhost:5173/auth`
2. Click "Sign up"
3. Enter your details with a **real email address**
4. Click "Create Account"
5. **Check your email inbox** for the OTP code
6. Enter the OTP to verify

✅ **Done!** Emails should now be sent automatically.

---

## 🔧 Alternative Email Providers

### Option 1: Outlook/Hotmail

```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@outlook.com"
SMTP_PASS="your-password"
```

**Note:** Outlook may require app-specific passwords. Go to:
- https://account.microsoft.com/security
- Advanced security options → App passwords

### Option 2: Yahoo Mail

```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@yahoo.com"
SMTP_PASS="your-app-password"
```

**Generate app password:**
- https://login.yahoo.com/account/security
- Generate app password

### Option 3: Custom SMTP Server

```env
SMTP_HOST="smtp.yourdomain.com"
SMTP_PORT="587"                    # or 465 for SSL
SMTP_SECURE="false"                # "true" for port 465
SMTP_USER="noreply@yourdomain.com"
SMTP_PASS="your-smtp-password"
```

### Option 4: SendGrid (Production Recommended)

1. Sign up at https://sendgrid.com/ (Free tier: 100 emails/day)
2. Create an API key
3. Configure:

```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"                 # Literally the word "apikey"
SMTP_PASS="SG.xxxxxxxxxxxxx"       # Your SendGrid API key
```

### Option 5: Mailgun (Production)

1. Sign up at https://www.mailgun.com/
2. Get SMTP credentials
3. Configure:

```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="postmaster@your-domain.mailgun.org"
SMTP_PASS="your-mailgun-password"
```

---

## 🐛 Troubleshooting

### Issue 1: "Missing credentials for PLAIN"

**Cause:** SMTP_USER or SMTP_PASS not set correctly

**Fix:**
1. Check `.env` file has no quotes around values (or use double quotes)
2. Make sure there are no spaces in the app password
3. Restart the server after changing `.env`

```env
# ❌ Wrong
SMTP_PASS='abcd efgh ijkl mnop'

# ✅ Correct
SMTP_PASS="abcdefghijklmnop"
```

### Issue 2: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Cause:** Using regular Gmail password instead of app password

**Fix:**
1. Enable 2-Factor Authentication on Gmail
2. Generate an App Password (see Step 2 above)
3. Use the 16-character app password, not your regular password

### Issue 3: "Connection timeout"

**Cause:** Firewall or network blocking SMTP port

**Fix:**
1. Check if port 587 is open: `telnet smtp.gmail.com 587`
2. Try port 465 with `SMTP_SECURE="true"`
3. Check your firewall settings
4. Try a different network (mobile hotspot)

### Issue 4: Emails going to spam

**Fix:**
1. Add "noreply@studybuddy.com" to contacts
2. Mark first email as "Not Spam"
3. For production, use a custom domain with SPF/DKIM records

### Issue 5: "self signed certificate in certificate chain"

**Fix:**
```env
# Add this to .env
NODE_TLS_REJECT_UNAUTHORIZED="0"
```
⚠️ Only use this for development, not production!

---

## 🧪 Testing Email Configuration

### Test 1: Check Server Logs

After signup, check the server terminal:

```bash
# ✅ Success
✅ OTP email sent to user@example.com

# ❌ Failure
⚠️  Failed to send OTP email: Error: Invalid login
📧 OTP for user@example.com: 123456 (Email service not configured)
```

### Test 2: Manual Test Script

Create `test-email.js`:

```javascript
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.sendMail({
  from: process.env.SMTP_USER,
  to: 'your-test-email@example.com',
  subject: 'Test Email from StudyBuddy',
  text: 'If you receive this, email is configured correctly!',
  html: '<h1>Success!</h1><p>Email configuration is working.</p>',
}, (error, info) => {
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Email sent:', info.messageId);
  }
});
```

Run it:
```bash
node test-email.js
```

### Test 3: Using curl

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"your-real-email@gmail.com","password":"test123","name":"Test User"}'
```

Check your email inbox!

---

## 📝 Email Templates

The system sends three types of emails:

### 1. OTP Verification Email
- **Subject:** "Verify Your Email - StudyBuddy"
- **Content:** 6-digit OTP code
- **Expiry:** 10 minutes

### 2. Password Reset Email
- **Subject:** "Reset Your Password - StudyBuddy"
- **Content:** Reset link with token
- **Expiry:** 1 hour

### 3. Welcome Email (Optional)
- **Subject:** "Welcome to StudyBuddy! 🎉"
- **Content:** Getting started guide

To customize templates, edit: `server/lib/email.ts`

---

## 🔒 Security Best Practices

### For Development:
✅ Use app-specific passwords (not your main password)
✅ Keep `.env` file in `.gitignore`
✅ Use different email for testing
✅ Rotate passwords regularly

### For Production:
✅ Use a dedicated email service (SendGrid, Mailgun)
✅ Set up SPF, DKIM, and DMARC records
✅ Use environment variables (not hardcoded)
✅ Enable rate limiting for email sending
✅ Monitor email delivery rates
✅ Use a custom domain (noreply@yourdomain.com)

---

## 🚀 Production Deployment

### Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add these variables:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

4. Click **Save**
5. Redeploy your application

### Using SendGrid (Recommended for Production)

**Why SendGrid?**
- ✅ Free tier: 100 emails/day
- ✅ Better deliverability
- ✅ Email analytics
- ✅ No 2FA setup needed
- ✅ Dedicated IP option

**Setup:**
1. Sign up: https://sendgrid.com/
2. Verify your sender email
3. Create API key
4. Update `.env`:

```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASS="SG.your-api-key-here"
```

---

## 📊 Monitoring Email Delivery

### Check Email Logs

Server logs show email status:

```bash
# Success
✅ OTP email sent to user@example.com

# Failure
⚠️  Failed to send OTP email: Error: ...
```

### Add Email Tracking (Optional)

Edit `server/lib/email.ts` to add tracking:

```typescript
// Add after sending email
console.log(`📧 Email sent to ${email}`, {
  messageId: info.messageId,
  response: info.response,
  timestamp: new Date().toISOString(),
});
```

---

## ✅ Verification Checklist

Before going live, verify:

- [ ] Gmail 2FA enabled
- [ ] App password generated
- [ ] `.env` file updated with correct credentials
- [ ] Server restarted after `.env` changes
- [ ] Test email received successfully
- [ ] OTP code works for verification
- [ ] Password reset email works
- [ ] Emails not going to spam
- [ ] `.env` file in `.gitignore`
- [ ] Production environment variables set

---

## 🆘 Still Having Issues?

### Quick Diagnostics

1. **Check .env file:**
   ```bash
   cat .env | grep SMTP
   ```

2. **Test SMTP connection:**
   ```bash
   telnet smtp.gmail.com 587
   ```

3. **Check server logs:**
   Look for "OTP email sent" or error messages

4. **Verify email address:**
   Make sure you're using a real, accessible email

5. **Check spam folder:**
   First emails often go to spam

### Common Mistakes

❌ Using regular password instead of app password
❌ Spaces in app password
❌ Wrong SMTP host or port
❌ 2FA not enabled on Gmail
❌ Firewall blocking port 587
❌ `.env` file not loaded (restart server)

---

## 📚 Additional Resources

- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833
- **Nodemailer Docs:** https://nodemailer.com/
- **SendGrid Setup:** https://docs.sendgrid.com/
- **SMTP Testing Tool:** https://www.smtper.net/

---

## 💡 Pro Tips

1. **Use a dedicated email** for sending (e.g., noreply@yourdomain.com)
2. **Test with multiple email providers** (Gmail, Outlook, Yahoo)
3. **Monitor delivery rates** in production
4. **Set up email templates** for consistent branding
5. **Add unsubscribe links** for marketing emails
6. **Use email verification services** to validate email addresses
7. **Implement retry logic** for failed email sends

---

**Need Help?** Check the server logs for detailed error messages or create an issue on GitHub.

**Working?** Great! Your users will now receive OTP codes via email automatically. 🎉
