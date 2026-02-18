/**
 * Express App Configuration (Vercel-compatible)
 * Separated from server/index.ts for Vercel serverless deployment
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import session from 'express-session';
import passport from 'passport';
import MongoStore from 'connect-mongo';

import './config/passport-config.js';
import authRoutes from './routes/auth.js';
import todoRoutes from './routes/todos.js';
import reportRoutes from './routes/reports.js';
import noticeRoutes from './routes/notices.js';
import aiRoutes from './routes/ai.js';
import userRoutes from './routes/users.js';
import faqRoutes from './routes/faqs.js';
import timerRoutes from './routes/timer.js';
import scheduleRoutes from './routes/schedule.js';
import friendsRoutes from './routes/friends.js';
import messagesRoutes from './routes/messages.js';
import usernameRoutes from './routes/username.js';
import backupRoutes from './routes/backup.js';
import newsRoutes from './routes/news.js';
import healthRoutes from './routes/health.js';
import adminRoutes from './routes/admin.js';
import { bodySizeGuard, securityHeaders } from './middleware/security.js';
import { globalRateLimiter } from './middleware/rateLimiting.js';

const app = express();

// Trust proxy for Vercel
app.set('trust proxy', 1);

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'https://sbd.satym.site',
  'https://studybuddyone.vercel.app',
  process.env.CLIENT_URL,
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Security middleware
app.use(securityHeaders);
app.use(bodySizeGuard(2 * 1024 * 1024));

// Compression
app.use(compression({
  filter: (req: any, res: any) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
}));

app.use(express.json({ limit: '1mb' }));

// Health check endpoints
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Global rate limiting
app.use(globalRateLimiter);

// Session configuration
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  ttl: 30 * 24 * 60 * 60,
  touchAfter: 24 * 3600,
  autoRemove: 'native',
  crypto: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  },
});

// Detect if running on HTTPS (production or HTTPS-configured dev)
const isHTTPS = process.env.NODE_ENV === 'production' ||
  process.env.CLIENT_URL?.startsWith('https');

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: sessionStore,
    name: 'studybuddy.sid',
    cookie: {
      secure: isHTTPS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: isHTTPS ? 'none' : 'lax',
      path: '/',
      domain: undefined,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Touch session middleware
app.use((req, _res, next) => {
  if (req.isAuthenticated() && req.session) {
    req.session.touch();
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/timer', timerRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/username', usernameRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler:', err);

  const { origin } = req.headers;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
