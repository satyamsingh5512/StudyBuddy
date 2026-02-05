# StudyBuddy - System Architecture

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LAYER                               │
│  Students | Educators | Admins | Public Users                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│  Web App (React) | Mobile (Capacitor) | PWA                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY LAYER                           │
│  Vercel Edge | Rate Limiter | Auth | CORS | Compression        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                             │
│  Auth | Tasks | AI | Social | Analytics | Admin | Email        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INTEGRATION LAYER                             │
│  Groq AI | Gemini | Google OAuth | Resend | MongoDB Atlas      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│  MongoDB (Users, Tasks, Reports, Friends, Messages, Sessions)  │
│  Caching (In-Memory, React Query, Browser, Service Worker)     │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI, Framer Motion, Jotai, React Query

**Backend**: Node.js, Express, TypeScript, Passport.js, bcrypt, JWT

**Database**: MongoDB with native driver, connection pooling, indexing

**AI Services**: Groq (Llama 3.3 70B), Google Gemini (Pro)

**Deployment**: Vercel (serverless), Capacitor (mobile)

**Communication**: Resend Email API

## Security Layers

1. Transport Security: HTTPS/TLS encryption
2. Authentication: JWT + Session cookies + OAuth 2.0
3. Authorization: Role-based access control
4. Input Validation: Schema validation + sanitization
5. Rate Limiting: IP-based + user-based throttling
6. Data Protection: Password hashing + encrypted storage
7. API Security: Key protection + CORS + CSRF
8. Monitoring: Real-time alerts + error tracking

## Performance Metrics

- API Response Time: < 500ms (95th percentile)
- Page Load Time: < 3 seconds (3G network)
- AI Response Time: < 2 seconds
- Database Query: < 100ms (indexed)
- Uptime SLA: 99.9% availability
- Concurrent Users: 10,000+ supported
