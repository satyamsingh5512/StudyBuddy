# StudyBuddy

An AI-powered study companion for competitive exam preparation. Live at [sbd.satym.in](https://sbd.satym.in)

## Features

**AI Study Assistant**
Gemini-powered study support for personalized recommendations, task suggestions, and motivational guidance based on your exam goals and progress.

**Task Management**
Create and track study tasks with subject categorization, difficulty levels, and question targets. Automatic progress calculation and completion tracking.

**Study Timer**
Pomodoro-style timer with session tracking, break management, and fullscreen focus mode. Complete history of all study sessions.

**Analytics Dashboard**
Track daily study hours, task completion rates, subject-wise progress, and performance trends. Streak tracking and points system for motivation.

**Social Learning**
Connect with peers through friend requests, activity feeds, and leaderboards. Direct messaging and study group conversations.

**Daily Reports**
Automated summaries of study activities including hours studied, tasks completed, subject coverage, and points earned.

**Exam Content**
Curated news, important dates, exam notifications, and study resources specific to your target examination.

**Schedule Management**
Create personalized study schedules with calendar integration and reminders. Share schedules with friends for accountability.

**Authentication**
Secure login with email-password. Email verification and password reset functionality.

**Web Platform**
Web application with responsive design, optimized for desktop and mobile browsers.

**Admin Dashboard**
User statistics, system monitoring, bulk email capabilities, and activity tracking.

## Technology Stack

Next.js 16 App Router, React 18, TypeScript, Tailwind CSS, TanStack Query, Jotai, Go 1.24 with Fiber, MongoDB, Vercel, Render, Google AI, and transactional email providers.

## Runtime and configuration

Use Node.js `>=20.9 <21` and Go 1.24. Install the locked frontend dependencies with `npm ci`; backend dependencies are managed by `backend/go.mod`.

Required backend variables:

- `MONGODB_URI`: MongoDB connection URI.
- `SESSION_SECRET`: unique random secret of at least 32 bytes. The API exits when it is missing or weak.
- `NODE_ENV=production`: enables `Secure`, `SameSite=None` session cookies for HTTPS deployments.
- One or more trusted app origins in `CLIENT_URL`, `NEXT_PUBLIC_APP_URL`, or comma-separated `ALLOWED_ORIGINS`.

Required frontend variables:

- `NEXT_PUBLIC_API_URL`: public API base URL including `/api`, for example `https://api.example.com/api`.
- `NEXT_PUBLIC_APP_URL`: canonical app origin, for example `https://app.example.com`.

Optional integrations require their corresponding Google OAuth, AI provider, and email provider variables. See the deployment platform configuration rather than committing secrets to the repository.

## Session and origin deployment requirements

Browser authentication is cookie-only through the `connect.sid` HttpOnly cookie. Tokens are not returned to JavaScript, stored in local storage, placed in URLs, or accepted as bearer credentials. Logout and password reset revoke outstanding sessions for the account.

Production app and API endpoints must use HTTPS. If they are cross-site, the browser must accept `Secure; SameSite=None` cookies, the frontend must send credentialed requests, and the exact frontend origin must be configured in the backend trusted-origin variables above. Validate this topology in a real target browser before release; command-line API checks do not exercise browser cookie policy.

Health endpoints are:

- `/api/health/live` for process liveness.
- `/api/health/ready` for MongoDB-backed readiness.
- `/api/health` for compatibility with existing monitors.

## Quality gates

The CI workflow runs frontend lint, TypeScript, production build, and critical dependency audit checks plus backend race tests, vet, and build checks. Local equivalents are documented in [Production readiness](docs/production-readiness.md).

See [Production readiness](docs/production-readiness.md) for shipped architecture decisions, residual risks, and release verification requirements.

## License

Proprietary software. All rights reserved.

## Contact

Visit [sbd.satym.in](https://sbd.satym.in) for support and inquiries.
