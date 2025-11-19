# StudyBuddy - AI-Powered Mentoring Platform

A production-ready platform for students preparing for competitive exams with AI-powered study planning, gamification, and community features.

## Features

- **AI Mentoring Engine**: Personalized study plans powered by Gemini AI
- **Dashboard & Todo System**: Draggable widgets, daily progress tracking
- **Study Timer**: Pomodoro-style timer with session tracking
- **Schedule Planner**: Weekly calendar with time slot management
- **Daily Reports**: Track progress and performance metrics
- **Gamification**: Points, streaks, leaderboard, and badges
- **Notices**: Exam-related announcements and updates
- **Group Chat**: Real-time community chat with rate limiting

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Framer Motion
- Jotai (state management)
- Socket.io Client

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- Socket.io
- Passport.js (Google OAuth)
- Gemini AI API

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Neon account)
- Google OAuth credentials
- Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd studybuddy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `DATABASE_URL`: Your PostgreSQL connection string
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
- `GEMINI_API_KEY`: From Google AI Studio
- `SESSION_SECRET`: Random secure string

4. Set up the database:
```bash
npm run db:generate
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

## Gemini AI Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to `.env` as `GEMINI_API_KEY`

## Docker Deployment

Build and run with Docker Compose:

```bash
docker-compose up -d
```

## Project Structure

```
studybuddy/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   └── ui/            # shadcn/ui components
│   ├── pages/             # Page components
│   ├── store/             # Jotai atoms
│   └── lib/               # Utilities
├── server/                # Backend source
│   ├── routes/            # API routes
│   ├── config/            # Configuration
│   ├── middleware/        # Express middleware
│   └── socket/            # Socket.io handlers
├── prisma/                # Database schema
└── public/                # Static assets
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Todos
- `GET /api/todos` - List todos
- `POST /api/todos` - Create todo
- `PATCH /api/todos/:id` - Update todo
- `DELETE /api/todos/:id` - Delete todo

### Reports
- `GET /api/reports` - List daily reports
- `POST /api/reports` - Submit daily report

### Users
- `GET /api/users/leaderboard` - Get top users
- `PATCH /api/users/profile` - Update profile

### AI
- `POST /api/ai/study-plan` - Generate AI study plan

### Notices
- `GET /api/notices` - List notices
- `POST /api/notices` - Create notice (admin)

## Socket.io Events

### Client → Server
- `join-chat` - Join global chat room
- `send-message` - Send chat message
- `typing` - Typing indicator

### Server → Client
- `chat-history` - Initial message history
- `new-message` - New chat message
- `user-typing` - User typing notification
- `rate-limit` - Rate limit warning

## Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Prisma Studio

## Environment Variables

See `.env.example` for all required variables.

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
# StudyBuddy
