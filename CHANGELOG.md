# Changelog

All notable changes to StudyBuddy will be documented in this file.

## [1.2.0] - 2026-01-19

### Added

#### Buddy Chat - AI Assistant Widget
- Floating chat widget accessible from any page
- Conversational AI powered by Groq (with Gemini fallback)
- Natural language task generation through chat
- One-click task addition with + button
- Minimize/maximize functionality
- Context-aware responses based on user's study history
- Study advice and motivation
- Dark mode support
- Mobile responsive design

#### New Files
- `src/components/BuddyChat.tsx` - AI chat widget component
- `BUDDY_CHAT.md` - Complete Buddy Chat documentation

#### New API Endpoint
- `POST /api/ai/buddy-chat` - Conversational AI endpoint
  - Natural language processing
  - Task extraction from conversation
  - Context-aware responses
  - Rate limited (10 req/min)

### Changed
- Updated `server/routes/ai.ts` with Buddy Chat endpoint
- Updated `src/components/Layout.tsx` to include BuddyChat widget
- Updated `README.md` with Buddy Chat features

### Features
- **Conversational Interface:** Natural language task creation
- **Smart Task Suggestions:** AI generates tasks with subject, difficulty, and question targets
- **One-Click Add:** Add suggested tasks directly to your list
- **Context Awareness:** Uses exam goal, study history, and days until exam
- **Minimizable Widget:** Doesn't obstruct the main interface
- **Real-time Responses:** Fast AI responses (1-3 seconds)
- **Error Handling:** Graceful fallbacks and user-friendly errors

---

## [1.1.0] - 2026-01-19

### Added

#### Groq AI Integration
- Integrated Groq AI for blazing-fast task generation (10x faster than Gemini)
- AI-powered study plan generation with user context
- Automatic fallback to Gemini if Groq unavailable
- Context-aware task suggestions based on study history

#### Exam News Feature
- Real-time exam news feed for JEE, NEET, GATE, UPSC, CAT, NDA, CLAT
- Important dates and deadlines tracking
- News caching (1-hour TTL) for performance
- Category-based news filtering
- Responsive news page with sidebar

#### Comprehensive Rate Limiting
- **Auth endpoints:** 5 requests per 15 minutes (prevent brute force)
- **AI endpoints:** 10 requests per minute (prevent abuse)
- **News endpoints:** 20 requests per minute
- **Upload endpoints:** 10 uploads per hour
- **Message endpoints:** 30 messages per minute (prevent spam)
- **Friend requests:** 10 requests per hour (prevent spam)
- **Report generation:** 20 reports per hour
- **General API:** 100 requests per minute
- **Global catch-all:** 200 requests per minute
- Rate limit headers in all responses
- Per-user and per-IP tracking
- Token bucket algorithm for smooth limiting

#### New Files
- `server/lib/groqClient.ts` - Groq AI client and helpers
- `server/routes/news.ts` - News API endpoints
- `server/middleware/rateLimiting.ts` - Advanced rate limiting
- `src/pages/News.tsx` - News feed UI
- `RATE_LIMITING.md` - Rate limiting documentation
- `.env.example` - Environment variables template

### Changed
- Updated `server/routes/ai.ts` to use Groq with Gemini fallback
- Updated `server/index.ts` to use new rate limiting middleware
- Updated `server/routes/auth.ts` with auth rate limiter
- Updated `server/routes/upload.ts` with upload rate limiter
- Updated `server/routes/messages.ts` with message rate limiter
- Updated `server/routes/friends.ts` with friend request rate limiter
- Updated `server/routes/reports.ts` with report rate limiter
- Updated `src/App.tsx` to include news route
- Updated `src/components/Layout.tsx` to add news navigation
- Updated `README.md` with new features and setup instructions

### Removed
- Removed 16 unnecessary files:
  - Migration scripts (6 files)
  - Redundant documentation (7 files)
  - Setup scripts (2 files)
  - Audit files (1 file)

### Dependencies
- Added `groq-sdk` for Groq AI integration

### Security
- Comprehensive rate limiting on all endpoints
- IP-based and user-based rate limiting
- Protection against brute force attacks
- Prevention of AI API abuse
- Spam prevention in messaging
- Upload abuse prevention

### Performance
- News caching reduces API calls by ~95%
- Groq AI provides 10x faster inference (300 vs 40 tokens/sec)
- Automatic cleanup of expired rate limit entries
- Optimized build with code splitting

### Documentation
- Added comprehensive rate limiting guide
- Added environment variables template
- Updated README with complete setup instructions
- Consolidated all essential docs

---

## [1.0.0] - Initial Release

### Features
- Smart task management with difficulty levels
- Pomodoro timer with fullscreen mode
- Daily reports and study analytics
- Real-time chat with Socket.io
- Friend system with direct messaging
- School/College/Coaching community chats
- Leaderboard and points system
- Google OAuth authentication
- Cloudinary image uploads
- PostgreSQL/CockroachDB database
- Mobile support with Capacitor
- Dark mode support
- Responsive design

---

**Legend:**
- Added: New features
- Changed: Changes to existing functionality
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Fixed: Bug fixes
- Security: Security improvements
