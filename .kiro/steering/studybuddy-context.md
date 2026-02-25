---
inclusion: always
---

# StudyBuddy Project Context

## Project Overview
StudyBuddy is an AI-powered study companion for competitive exam preparation (NEET, JEE, GATE, UPSC, CAT, etc.). Live at: https://sbd.satym.in

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Jotai for state management
- React Query for server state
- React Router for routing

### Backend
- Node.js with Express
- TypeScript with ES modules
- MongoDB with native driver
- Passport.js for authentication (Local + Google OAuth)
- Session-based authentication with MongoDB store

### AI Integration
- Groq API (Llama 3.3 70B) - Primary AI model
- Google Gemini API (Gemini Pro) - Secondary AI model
- Multi-model support with user selection

### Deployment
- Vercel serverless functions
- MongoDB Atlas for database
- Resend for email service
- Capacitor for mobile apps

## Important Project Rules

### ES Modules
- ALL relative imports in server files MUST use `.js` extensions
- Example: `import { db } from '../lib/db.js'`
- This is required for Vercel serverless deployment
- Local development works without extensions (tsx handles it)

### Authentication
- Admin email: satyamsinghpx@gmail.com
- Temporary emails are blocked (150+ domains)
- Google OAuth and email/password supported
- Session-based with httpOnly cookies

### AI Features
- BuddyChat requires authentication
- Users can switch between Groq and Gemini models
- Context-aware responses based on exam goal and progress
- Task generation from AI conversations

### Database
- MongoDB collections: users, todos, dailyReports, friends, messages, sessions
- Connection pooling enabled
- Indexes on userId, email, date fields

### API Structure
- All API routes under `/api/*`
- Rate limiting enabled
- CORS configured for production domain
- Compression enabled for responses

## File Structure

```
├── api/index.ts              # Vercel serverless entry
├── server/
│   ├── app.ts               # Express app setup
│   ├── routes/              # API route handlers
│   ├── middleware/          # Auth, rate limiting, etc.
│   ├── lib/                 # DB, email, AI clients
│   └── config/              # Passport configuration
├── src/
│   ├── components/          # React components
│   ├── pages/              # Route pages
│   ├── lib/                # Client utilities
│   └── store/              # Jotai atoms
└── public/                 # Static assets
```

## Development Commands

```bash
npm run dev          # Start both client and server
npm run dev:client   # Vite dev server (port 5173)
npm run dev:server   # Express server (port 3001)
npm run build        # Build for production
npm run preview      # Preview production build
```

## Environment Variables

Required in `.env`:
- `MONGODB_URI` - MongoDB connection string
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `GROQ_API_KEY` - Groq AI API key
- `GEMINI_API_KEY` - Google Gemini API key
- `RESEND_API_KEY` - Email service API key
- `VITE_API_URL` - API base URL

## Common Tasks

### Adding New API Route
1. Create route file in `server/routes/`
2. Add `.js` extensions to all relative imports
3. Register route in `server/app.ts`
4. Add authentication middleware if needed

### Adding New Component
1. Create in `src/components/`
2. Use TypeScript interfaces for props
3. Follow existing patterns (Radix UI, Tailwind)
4. Add to appropriate page

### Database Operations
1. Use `db` from `server/lib/db.js`
2. Always use ObjectId for _id fields
3. Add indexes for frequently queried fields
4. Use connection pooling (already configured)

## Testing

- Manual testing in development
- Test authentication flows
- Test AI model switching
- Test mobile responsiveness
- Verify Vercel deployment

## Deployment

1. Push to GitHub main branch
2. Vercel auto-deploys
3. Check deployment logs for errors
4. Verify environment variables in Vercel dashboard
5. Test production at sbd.satym.in

## Known Issues & Solutions

### ES Module Errors on Vercel
- Add `.js` extensions to all relative imports in server files
- See VERCEL_MODULE_FIX.md for details

### AI API Rate Limits
- Groq: 14,400 requests/day (free tier)
- Gemini: 1,500 requests/day (free tier)
- Implement caching and rate limiting

### Session Issues
- Sessions stored in MongoDB
- 30-day TTL
- Clear old sessions with cleanup script

## Security Considerations

- Never commit `.env` file
- API keys stored in Vercel environment variables
- Passwords hashed with bcrypt (12 rounds)
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS restricted to production domain
- httpOnly cookies for sessions

## Performance Optimizations

- React Query caching (30s stale time)
- In-memory cache for leaderboards (5min TTL)
- Code splitting with lazy loading
- Image optimization
- Compression middleware
- MongoDB indexes

## Future Enhancements

- Video call study sessions
- Advanced analytics with ML
- Marketplace for study materials
- Integration with educational institutions
- Mobile app push notifications
