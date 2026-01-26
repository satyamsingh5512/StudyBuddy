# Client-Server Architecture Guide
## Vercel (Frontend) + Render (Backend) on Free Tiers

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Current Implementation](#current-implementation)
3. [Free Tier Limitations](#free-tier-limitations)
4. [Performance Optimizations](#performance-optimizations)
5. [Deployment Guide](#deployment-guide)
6. [Best Practices](#best-practices)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ├─── Static Assets (HTML, CSS, JS)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • React SPA (Vite)                                    │ │
│  │  • Static file serving                                 │ │
│  │  • Client-side routing                                 │ │
│  │  • UI components                                       │ │
│  │  • State management (Jotai)                            │ │
│  │  • API client (fetch with credentials)                │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS API Calls
                         │ (with credentials: 'include')
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    RENDER (Backend)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • Express.js Server                                   │ │
│  │  • RESTful API endpoints                               │ │
│  │  • Authentication (Passport.js)                        │ │
│  │  • Session management (MongoDB)                        │ │
│  │  • Business logic                                      │ │
│  │  • Database operations                                 │ │
│  │  • Email service                                       │ │
│  │  • Socket.IO (real-time)                               │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MONGODB ATLAS (Database)                   │
│  • User data                                                 │
│  • Session store                                             │
│  • Application data                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Current Implementation

### Frontend (Vercel)
**Location:** `/src`, `/public`, `index.html`

**Responsibilities:**
- ✅ Render UI components
- ✅ Handle user interactions
- ✅ Client-side routing (React Router)
- ✅ State management (Jotai)
- ✅ API calls to backend
- ✅ Static asset serving
- ✅ Client-side caching

**Key Files:**
```
src/
├── App.tsx                 # Main app component
├── main.tsx               # Entry point
├── config/
│   └── api.ts            # API configuration (API_URL)
├── pages/                # Page components
├── components/           # Reusable components
├── lib/                  # Utilities
└── store/                # State management
```

**API Configuration:**
```typescript
// src/config/api.ts
export const API_URL = import.meta.env.VITE_API_URL || '/api';

export const apiFetch = (path: string, options?: RequestInit) => {
  return fetch(`${API_URL}${path}`, {
    credentials: 'include',  // Important for sessions
    ...options,
  });
};
```

### Backend (Render)
**Location:** `/server`

**Responsibilities:**
- ✅ RESTful API endpoints
- ✅ Authentication & authorization
- ✅ Session management
- ✅ Database operations
- ✅ Business logic
- ✅ Email service
- ✅ Real-time features (Socket.IO)
- ✅ Rate limiting
- ✅ Security middleware

**Key Files:**
```
server/
├── index.ts              # Server entry point
├── app.ts                # Express app configuration
├── routes/               # API endpoints
│   ├── auth.ts          # Authentication
│   ├── todos.ts         # Todo CRUD
│   ├── users.ts         # User management
│   └── ...
├── middleware/           # Express middleware
│   ├── auth.ts          # Auth middleware
│   ├── rateLimiting.ts  # Rate limiting
│   └── security.ts      # Security headers
├── lib/                  # Utilities
│   ├── db.ts            # Database abstraction
│   ├── mongodb.ts       # MongoDB connection
│   └── email.ts         # Email service
└── config/
    └── passport.ts       # Passport configuration
```

**Server Configuration:**
```typescript
// server/app.ts
const app = express();

// Trust proxy (required for Render)
app.set('trust proxy', 1);

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-app.vercel.app',
    process.env.FRONTEND_URL
  ],
  credentials: true,
}));

// Session configuration
app.use(session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none', // Required for cross-origin
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));
```

---

## ⚠️ Free Tier Limitations

### Vercel Free Tier
| Feature | Limit | Impact |
|---------|-------|--------|
| Bandwidth | 100 GB/month | ✅ Sufficient for most apps |
| Build time | 6000 minutes/month | ✅ More than enough |
| Deployments | Unlimited | ✅ Great for CI/CD |
| Functions | 100 GB-hours | ✅ Not using serverless functions |
| Edge Network | Global CDN | ✅ Fast worldwide |

**Pros:**
- ✅ Instant deployments
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ No cold starts (static files)

**Cons:**
- ❌ Cannot run backend server
- ❌ No persistent storage

### Render Free Tier
| Feature | Limit | Impact |
|---------|-------|--------|
| RAM | 512 MB | ⚠️ Limited |
| CPU | Shared | ⚠️ Can be slow |
| Bandwidth | 100 GB/month | ✅ Sufficient |
| Build time | 500 minutes/month | ✅ Enough |
| **Sleep after 15 min** | **Inactive** | ⚠️ **Major limitation** |

**Pros:**
- ✅ Can run Node.js server
- ✅ Persistent connections (WebSocket)
- ✅ Background jobs

**Cons:**
- ❌ **Sleeps after 15 minutes of inactivity**
- ❌ **30-50 second cold start**
- ❌ Limited resources (512 MB RAM)
- ❌ Shared CPU (can be slow)

### MongoDB Atlas Free Tier (M0)
| Feature | Limit | Impact |
|---------|-------|--------|
| Storage | 512 MB | ⚠️ Limited |
| RAM | Shared | ⚠️ Can be slow |
| Connections | 500 max | ✅ Sufficient |
| Bandwidth | Unlimited | ✅ Great |

---

## 🚀 Performance Optimizations

### 1. Handle Render Sleep (Most Important!)

**Problem:** Render free tier sleeps after 15 minutes of inactivity. First request takes 30-50 seconds.

**Solutions Implemented:**

#### A. Keep-Alive Workflow (Recommended)
```yaml
# .github/workflows/keep-alive.yml
name: Keep Render Service Alive

on:
  schedule:
    - cron: '*/14 * * * *'  # Every 14 minutes
  workflow_dispatch:

jobs:
  keep-alive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render Service
        run: |
          curl -f https://your-app.onrender.com/api/health || exit 0
```

**Benefits:**
- ✅ Keeps service awake 24/7
- ✅ No cold starts for users
- ✅ Free (GitHub Actions)

**Setup:**
1. Update the URL in `.github/workflows/keep-alive.yml`
2. Push to GitHub
3. Enable GitHub Actions in repository settings

#### B. Loading State for Cold Starts
```typescript
// src/components/ServerWakeup.tsx
export function ServerWakeup() {
  const [isWaking, setIsWaking] = useState(false);
  
  useEffect(() => {
    const checkServer = async () => {
      const start = Date.now();
      try {
        await fetch(`${API_URL}/api/health`);
        const duration = Date.now() - start;
        
        if (duration > 5000) {
          setIsWaking(true);
          // Show "Server is waking up" message
        }
      } catch (error) {
        setIsWaking(true);
      }
    };
    
    checkServer();
  }, []);
  
  if (isWaking) {
    return <div>Server is waking up, please wait...</div>;
  }
  
  return null;
}
```

### 2. Frontend Optimizations

#### A. Code Splitting
```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Suspense>
  );
}
```

**Benefits:**
- ✅ Smaller initial bundle
- ✅ Faster first load
- ✅ Load pages on demand

#### B. API Response Caching
```typescript
// src/config/api.ts
const cache = new Map();

export const apiFetchCached = async (path: string, ttl = 5 * 60 * 1000) => {
  const cached = cache.get(path);
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const response = await apiFetch(path);
  const data = await response.json();
  
  cache.set(path, { data, timestamp: Date.now() });
  return data;
};
```

**Benefits:**
- ✅ Reduces API calls
- ✅ Faster perceived performance
- ✅ Less load on backend

#### C. Optimistic Updates
```typescript
// src/hooks/useOptimisticMutation.ts
export function useOptimisticMutation() {
  const [data, setData] = useState([]);
  
  const addItem = async (newItem) => {
    // Update UI immediately
    setData([...data, { ...newItem, id: 'temp' }]);
    
    try {
      // Send to server
      const result = await apiFetch('/items', {
        method: 'POST',
        body: JSON.stringify(newItem),
      });
      
      // Replace temp with real data
      setData(prev => prev.map(item => 
        item.id === 'temp' ? result : item
      ));
    } catch (error) {
      // Rollback on error
      setData(prev => prev.filter(item => item.id !== 'temp'));
    }
  };
  
  return { data, addItem };
}
```

**Benefits:**
- ✅ Instant UI feedback
- ✅ Better UX
- ✅ Handles errors gracefully

### 3. Backend Optimizations

#### A. Database Connection Pooling
```typescript
// server/lib/mongodb.ts
const mongoClient = new MongoClient(MONGODB_URI, {
  maxPoolSize: 10,        // Reuse connections
  minPoolSize: 2,         // Keep minimum alive
  maxIdleTimeMS: 60000,   // Close idle after 1 min
});
```

**Benefits:**
- ✅ Faster queries
- ✅ Less connection overhead
- ✅ Better resource usage

#### B. Database Indexes
```typescript
// server/lib/mongodb.ts
async function createIndexes(db) {
  // Speed up common queries
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('todos').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
}
```

**Benefits:**
- ✅ 10-100x faster queries
- ✅ Essential for performance

#### C. Response Compression
```typescript
// server/app.ts
import compression from 'compression';

app.use(compression({
  level: 6,  // Balance between speed and size
  threshold: 1024,  // Only compress > 1KB
}));
```

**Benefits:**
- ✅ 60-80% smaller responses
- ✅ Faster data transfer
- ✅ Less bandwidth usage

#### D. Rate Limiting
```typescript
// server/middleware/rateLimiting.ts
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // 100 requests per window
  message: 'Too many requests, please try again later',
});
```

**Benefits:**
- ✅ Prevents abuse
- ✅ Protects free tier resources
- ✅ Better stability

### 4. Session Management

#### A. MongoDB Session Store
```typescript
// server/app.ts
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  ttl: 30 * 24 * 60 * 60,  // 30 days
  touchAfter: 24 * 3600,    // Update once per day
  autoRemove: 'native',     // Auto cleanup
});
```

**Benefits:**
- ✅ Persistent sessions
- ✅ Survives server restarts
- ✅ Works with Render sleep

#### B. Session Touch Middleware
```typescript
// server/app.ts
app.use((req, res, next) => {
  if (req.isAuthenticated() && req.session) {
    req.session.touch();  // Extend session
  }
  next();
});
```

**Benefits:**
- ✅ Sessions don't expire during use
- ✅ Better UX

---

## 📦 Deployment Guide

### Step 1: Prepare Environment Variables

#### Vercel (Frontend)
```bash
# In Vercel Dashboard → Settings → Environment Variables
VITE_API_URL=https://your-app.onrender.com
```

#### Render (Backend)
```bash
# In Render Dashboard → Environment
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=random-secret-string
FRONTEND_URL=https://your-app.vercel.app
ALLOWED_ORIGINS=https://your-app.vercel.app,https://sbd.satym.site
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GROQ_API_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

### Step 2: Deploy Backend (Render)

1. **Connect GitHub Repository**
   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build**
   ```yaml
   Build Command: npm install
   Start Command: npx tsx server/index.ts
   ```

3. **Set Environment Variables** (from above)

4. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete
   - Copy the service URL

### Step 3: Deploy Frontend (Vercel)

1. **Connect GitHub Repository**
   - Go to Vercel Dashboard
   - Click "Add New..." → "Project"
   - Import your GitHub repository

2. **Configure Build**
   ```yaml
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

3. **Set Environment Variables**
   - Add `VITE_API_URL` with your Render URL

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

### Step 4: Update CORS

1. Go back to Render Dashboard
2. Add your Vercel URL to `ALLOWED_ORIGINS`
3. Service will restart automatically

### Step 5: Enable Keep-Alive (Optional but Recommended)

1. Update `.github/workflows/keep-alive.yml` with your Render URL
2. Push to GitHub
3. Enable GitHub Actions in repository settings

---

## ✅ Best Practices

### 1. API Design

#### Use RESTful Conventions
```typescript
GET    /api/todos          # List all
GET    /api/todos/:id      # Get one
POST   /api/todos          # Create
PUT    /api/todos/:id      # Update
DELETE /api/todos/:id      # Delete
```

#### Always Include Credentials
```typescript
fetch(`${API_URL}/api/todos`, {
  credentials: 'include',  // Required for sessions
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

#### Handle Errors Gracefully
```typescript
try {
  const response = await apiFetch('/api/todos');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  return await response.json();
} catch (error) {
  console.error('Failed to fetch todos:', error);
  toast.error(error.message);
}
```

### 2. Security

#### CORS Configuration
```typescript
// server/app.ts
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      process.env.FRONTEND_URL,
      ...process.env.ALLOWED_ORIGINS?.split(',')
    ];
    
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

#### Secure Cookies
```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production',  // HTTPS only
  httpOnly: true,                                  // No JS access
  sameSite: 'none',                               // Cross-origin
  maxAge: 30 * 24 * 60 * 60 * 1000,              // 30 days
}
```

#### Rate Limiting
```typescript
// Protect expensive endpoints
app.use('/api/ai', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests
}));
```

### 3. Error Handling

#### Backend
```typescript
// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});
```

#### Frontend
```typescript
// Error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Log to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorPage />;
    }
    return this.props.children;
  }
}
```

### 4. Monitoring

#### Health Check Endpoint
```typescript
// server/app.ts
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

#### Log Important Events
```typescript
// Login
console.log('✅ User logged in:', user.email);

// Errors
console.error('❌ Database error:', error);

// Performance
console.log('⏱️  Query took:', duration, 'ms');
```

---

## 📊 Monitoring & Maintenance

### Daily Checks
- [ ] Check Render logs for errors
- [ ] Check Vercel deployment status
- [ ] Monitor MongoDB storage usage
- [ ] Check keep-alive workflow status

### Weekly Checks
- [ ] Review error logs
- [ ] Check bandwidth usage
- [ ] Monitor response times
- [ ] Review user feedback

### Monthly Checks
- [ ] Update dependencies
- [ ] Review security advisories
- [ ] Optimize database queries
- [ ] Clean up old data

### Useful Commands

```bash
# Check Render logs
# Via Dashboard → Your Service → Logs

# Check Vercel logs
# Via Dashboard → Your Project → Deployments → Logs

# Test health endpoint
curl https://your-app.onrender.com/api/health

# Test CORS
curl -H "Origin: https://your-app.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-app.onrender.com/api/auth/login
```

---

## 🎯 Performance Metrics

### Target Metrics
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- API Response Time: < 500ms (warm)
- API Response Time: < 30s (cold start)

### Monitoring Tools
- Vercel Analytics (built-in)
- Render Metrics (dashboard)
- MongoDB Atlas Metrics (dashboard)
- Browser DevTools (Network, Performance)

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [React Performance](https://react.dev/learn/render-and-commit)

---

## 🆘 Troubleshooting

### Issue: CORS Error
**Solution:** Check `ALLOWED_ORIGINS` in Render includes your Vercel URL

### Issue: Session Not Persisting
**Solution:** Verify `credentials: 'include'` in all fetch calls

### Issue: Slow First Load
**Solution:** Enable keep-alive workflow or show loading state

### Issue: 502 Bad Gateway
**Solution:** Render service is sleeping, wait 30 seconds

### Issue: MongoDB Connection Failed
**Solution:** Check IP whitelist in MongoDB Atlas (allow 0.0.0.0/0)

---

## ✨ Summary

Your application is already properly architected for a client-server setup with:

✅ **Frontend (Vercel):** Static React SPA with global CDN
✅ **Backend (Render):** Express.js API with MongoDB
✅ **Optimizations:** Caching, compression, connection pooling
✅ **Security:** CORS, rate limiting, secure sessions
✅ **Monitoring:** Health checks, logging, error handling

The main limitation is Render's sleep behavior, which is mitigated by the keep-alive workflow. Everything else is production-ready!
