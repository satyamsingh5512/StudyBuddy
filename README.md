# StudyBuddy

AI-powered study companion for competitive exam preparation with intelligent task generation and real-time exam news.

**Features:** Smart task management • AI task generation • Pomodoro timer • Study analytics • Real-time chat • Friend system • Exam news & updates

**Live Demo:** [studybuddyone.vercel.app](https://studybuddyone.vercel.app)

**Tech:** React • TypeScript • Express.js • PostgreSQL • Groq AI • Socket.io

## 🚀 Features

### AI Task Generation (Groq)
- Generate personalized study tasks with natural language
- Context-aware suggestions based on your study history
- Supports all major competitive exams (JEE, NEET, GATE, UPSC, etc.)
- 10x faster than traditional AI (300 tokens/sec)

### Exam News & Updates
- Latest announcements and notifications for JEE, NEET, GATE, UPSC, CAT, NDA, CLAT
- Important dates and deadlines
- Syllabus changes and exam patterns
- Auto-refreshing news feed

### Study Management
- Smart todo system with difficulty levels
- Pomodoro timer with fullscreen mode
- Daily reports and analytics
- Study streak tracking

### Social Features
- Real-time chat with study groups
- Friend system with direct messaging
- School/College/Coaching community chats
- Leaderboard and points system

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (or CockroachDB)
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Installation

1. **Clone and install**
```bash
git clone <repo-url>
cd StudyBuddy
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/studybuddy"

# Session
SESSION_SECRET="your-random-secret"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
CLIENT_URL="http://localhost:5173"

# Groq AI (Required for task generation & news)
GROQ_API_KEY="gsk_your_groq_api_key"

# Gemini (Optional fallback)
GEMINI_API_KEY="your-gemini-key"

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

3. **Setup database**
```bash
npm run db:push
```

4. **Start development**
```bash
npm run dev
```

App runs at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## 📦 Build & Deploy

```bash
# Build frontend
npm run build

# Start production server
npm run start:server
```

## 🔑 Getting API Keys

### Groq AI (Required)
1. Visit [console.groq.com](https://console.groq.com)
2. Sign up and create API key
3. Copy key starting with `gsk_`

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project and enable OAuth
3. Add authorized redirect: `http://localhost:3001/api/auth/google/callback`

### Cloudinary
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Get credentials from dashboard

## 📱 Mobile (Android)

```bash
npm run cap:init
npm run cap:add:android
npm run android:dev
```

## 🧪 Scripts

```bash
npm run dev              # Start both client & server
npm run dev:client       # Start Vite dev server
npm run dev:server       # Start Express server
npm run build            # Build for production
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio
npm run clean            # Clean processes
npm run lint             # Run ESLint
npm run format           # Format with Prettier
```

## 🏗️ Project Structure

```
StudyBuddy/
├── src/                 # React frontend
│   ├── components/      # UI components
│   ├── pages/          # Page components
│   ├── store/          # Jotai state
│   └── lib/            # Utilities
├── server/             # Express backend
│   ├── routes/         # API routes
│   ├── lib/            # Server utilities
│   ├── middleware/     # Auth, security
│   └── socket/         # Socket.io handlers
├── prisma/             # Database schema
└── public/             # Static assets
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

MIT License - see LICENSE file for details
