# Deployment Guide

## Deploy to GitHub

### Step 1: Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit: StudyBuddy - Todo list with community support"
```

### Step 2: Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository named `studybuddy`
3. Don't initialize with README (we already have one)
4. Copy the repository URL

### Step 3: Push to GitHub

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/studybuddy.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Environment Variables

**Important**: Never commit `.env` file to GitHub!

The `.gitignore` already excludes:
- `.env`
- `.env.local`
- `.env.*.local`

### For Deployment

You'll need to set these environment variables on your hosting platform:

```env
DATABASE_URL="your-neon-database-url"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="https://your-domain.com/api/auth/google/callback"
SESSION_SECRET="your-random-secret"
GEMINI_API_KEY="your-gemini-api-key"
PORT=3001
NODE_ENV="production"
CLIENT_URL="https://your-domain.com"
```

## Deployment Options

### Option 1: Vercel (Recommended for Frontend)

**Frontend Deployment:**

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard

**Backend**: Deploy separately on Railway, Render, or Heroku

### Option 2: Railway (Full-Stack)

1. Go to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Add environment variables
6. Deploy

### Option 3: Render (Full-Stack)

1. Go to [Render](https://render.com)
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub repository
5. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
6. Add environment variables
7. Deploy

### Option 4: Heroku

1. Install Heroku CLI
2. Login:
```bash
heroku login
```

3. Create app:
```bash
heroku create studybuddy-app
```

4. Add PostgreSQL:
```bash
heroku addons:create heroku-postgresql:mini
```

5. Set environment variables:
```bash
heroku config:set GOOGLE_CLIENT_ID=your-id
heroku config:set GOOGLE_CLIENT_SECRET=your-secret
# ... set all other variables
```

6. Deploy:
```bash
git push heroku main
```

## Docker Deployment

### Build Docker Image

```bash
docker build -t studybuddy .
```

### Run with Docker Compose

```bash
docker-compose up -d
```

### Push to Docker Hub

```bash
docker tag studybuddy your-username/studybuddy
docker push your-username/studybuddy
```

## Post-Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Google OAuth callback URL updated
- [ ] SSL certificate configured (HTTPS)
- [ ] Domain configured
- [ ] Database backups enabled
- [ ] Error monitoring set up (Sentry)
- [ ] Analytics configured (optional)

## Update Google OAuth

After deployment, update Google OAuth settings:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to your project
3. Go to "Credentials"
4. Edit your OAuth 2.0 Client ID
5. Add authorized redirect URI:
   ```
   https://your-domain.com/api/auth/google/callback
   ```

## Database Setup

### Neon (Recommended)

1. Your Neon database is already set up
2. Update `DATABASE_URL` in production environment
3. Run migrations:
```bash
npm run db:push
```

### Alternative: Heroku Postgres

```bash
heroku addons:create heroku-postgresql:mini
# DATABASE_URL is automatically set
npm run db:push
```

## Monitoring

### Error Tracking (Sentry)

1. Sign up at [Sentry](https://sentry.io)
2. Create new project
3. Install SDK:
```bash
npm install @sentry/node @sentry/react
```

4. Configure in your app

### Uptime Monitoring

- [UptimeRobot](https://uptimerobot.com) - Free
- [Pingdom](https://pingdom.com)
- [StatusCake](https://statuscake.com)

## CI/CD (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      - run: npm test
      # Add deployment steps
```

## Troubleshooting

### Build Fails

- Check Node.js version (20+)
- Verify all dependencies installed
- Check for TypeScript errors

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check if database is accessible from deployment server
- Ensure SSL mode is set correctly

### OAuth Not Working

- Verify callback URL matches exactly
- Check GOOGLE_CLIENT_ID and SECRET
- Ensure domain is authorized in Google Console

## Security Checklist

- [ ] Environment variables not in code
- [ ] SESSION_SECRET is random and secure
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] SQL injection protection (Prisma handles this)
- [ ] XSS protection (React handles this)

## Performance Optimization

- [ ] Enable gzip compression
- [ ] Set up CDN for static assets
- [ ] Enable database connection pooling
- [ ] Configure caching headers
- [ ] Minify and bundle assets

## Backup Strategy

### Database Backups

**Neon**: Automatic backups included

**Manual Backup**:
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Code Backups

- GitHub serves as code backup
- Tag releases:
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## Support

For deployment issues:
1. Check logs: `heroku logs --tail` or platform-specific logs
2. Verify environment variables
3. Check database connectivity
4. Review error messages

---

Ready to deploy! 🚀
