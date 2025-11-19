# StudyBuddy Setup Guide

## Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` with your credentials:

```env
# Database - Use Neon or local PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/studybuddy"

# Google OAuth - Get from https://console.cloud.google.com/
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

# Session Secret - Generate a random string
SESSION_SECRET="your-random-secret-string-change-this"

# Gemini AI - Get from https://makersuite.google.com/app/apikey
GEMINI_API_KEY="your-gemini-api-key"

# Server Config
PORT=3001
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"
```

### 2. Database Setup

#### Option A: Using Neon (Recommended for Development)

1. Sign up at [Neon](https://neon.tech)
2. Create a new project
3. Copy the connection string to `DATABASE_URL` in `.env`
4. Run migrations:

```bash
npm run db:push
```

#### Option B: Local PostgreSQL

1. Install PostgreSQL
2. Create a database:

```bash
createdb studybuddy
```

3. Update `DATABASE_URL` in `.env`
4. Run migrations:

```bash
npm run db:push
```

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure consent screen if prompted
6. Application type: "Web application"
7. Add authorized redirect URI:
   - `http://localhost:3001/api/auth/google/callback`
8. Copy Client ID and Client Secret to `.env`

### 4. Gemini AI Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key to `GEMINI_API_KEY` in `.env`

### 5. Start Development

```bash
npm run dev
```

This starts both frontend (port 5173) and backend (port 3001).

Access the app at: http://localhost:5173

## Troubleshooting

### Port Already in Use

If ports 3001 or 5173 are in use:

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check if PostgreSQL is running
- For Neon, ensure your IP is allowed

### Google OAuth Not Working

- Verify redirect URI matches exactly in Google Console
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Ensure `GOOGLE_CALLBACK_URL` matches your backend URL

### Prisma Issues

Regenerate Prisma client:

```bash
npm run db:generate
```

Reset database (WARNING: deletes all data):

```bash
npx prisma db push --force-reset
```

## Development Commands

```bash
# Start both frontend and backend
npm run dev

# Start only frontend
npm run dev:client

# Start only backend
npm run dev:server

# Build for production
npm run build

# Run linter
npm run lint

# Format code
npm run format

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Production Deployment

### Using Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Deployment

1. Set environment variables on your server
2. Build the application:

```bash
npm run build
```

3. Start the server:

```bash
NODE_ENV=production node server/index.js
```

## Project Structure

```
studybuddy/
├── src/                    # Frontend React app
│   ├── components/         # Reusable components
│   │   └── ui/            # shadcn/ui components
│   ├── pages/             # Page components
│   ├── store/             # Jotai state atoms
│   └── lib/               # Utility functions
├── server/                # Backend Express app
│   ├── routes/            # API route handlers
│   ├── config/            # Configuration files
│   ├── middleware/        # Express middleware
│   └── socket/            # Socket.io handlers
├── prisma/                # Database schema
│   └── schema.prisma      # Prisma schema file
└── public/                # Static assets
```

## Next Steps

1. Customize the AI prompts in `server/routes/ai.ts`
2. Add more widgets to the dashboard
3. Implement drag-and-drop with @dnd-kit
4. Add more gamification features
5. Customize the theme in `src/index.css`

## Support

For issues, check:
- Console logs in browser DevTools
- Server logs in terminal
- Database with `npm run db:studio`

Happy coding! 🚀
