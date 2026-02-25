import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { createServer } from 'http';

import './config/passport-config.js';
import authRoutes from './routes/auth.js';
import todoRoutes from './routes/todos.js';
import reportRoutes from './routes/reports.js';
import noticeRoutes from './routes/notices.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/users.js';
import faqRoutes from './routes/faqs.js';
import timerRoutes from './routes/timer.js';
import scheduleRoutes from './routes/schedule.js';
import friendsRoutes from './routes/friends.js';
import messagesRoutes from './routes/messages.js';
import usernameRoutes from './routes/username.js';
import backupRoutes from './routes/backup.js';
import newsRoutes from './routes/news.js';
import waitlistRoutes from './routes/waitlist.js';
import healthRoutes from './routes/health.js';
import uploadRoutes from './routes/upload.js';
import { getMongoDb, closeMongoDb } from './lib/mongodb.js';
import { bodySizeGuard, securityHeaders } from './middleware/security.js';
import { globalRateLimiter } from './middleware/rateLimiting.js';
import { startKeepAlive } from './lib/keepAlive.js';

// Initialize database before starting server
async function startServer() {
  // Initialize MongoDB connection
  const db = await getMongoDb();
  if (!db) {
    console.error('\n❌ MongoDB connection failed!');
    console.error('Please check your MONGODB_URI in .env file');
    console.error('Common issues:');
    console.error('  1. Invalid credentials (username/password)');
    console.error('  2. IP address not whitelisted in MongoDB Atlas');
    console.error('  3. Database name incorrect');
    console.error('  4. Network connectivity issues\n');
    console.error('Current MONGODB_URI:', process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@'));
    console.error('\nServer will continue but authentication will NOT work!\n');
  } else {
    console.log('✅ MongoDB connected and ready');
    console.log('📊 Database: MongoDB (Native Driver)');
  }

  const app = express();

  // Trust proxy for production deployments
  app.set('trust proxy', 1);

  const httpServer = createServer(app);

  // CORS configuration
  const rawAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'https://sbd.satym.in',
    process.env.CLIENT_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
  ].filter(Boolean) as string[];

  // Normalize origins (remove trailing slashes)
  const allowedOrigins = rawAllowedOrigins.map(o => o.replace(/\/$/, ''));

  console.log('🌐 Allowed CORS Origins:', allowedOrigins);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Capacitor)
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');

        // Allow exact matches from the whitelist
        const isExact = allowedOrigins.includes(normalizedOrigin);

        // Allow any Vercel preview deployment (*.vercel.app)
        const isVercel = /^https:\/\/[a-zA-Z0-9-]+-[a-zA-Z0-9]+-[a-zA-Z0-9-]+\.vercel\.app$/.test(normalizedOrigin)
          || normalizedOrigin.endsWith('.vercel.app');

        if (isExact || isVercel) {
          callback(null, true);
        } else {
          console.error(`❌ CORS blocked request from origin: ${origin}`);
          callback(new Error(`Not allowed by CORS: ${origin}`));
        }
      },
      credentials: true,
    })
  );

  // Security middleware
  app.use(securityHeaders);
  app.use(bodySizeGuard(2 * 1024 * 1024));

  // Cookie parser (for JWT cookies)
  app.use(cookieParser());

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

  const session = (await import('express-session')).default;
  const MongoStore = (await import('connect-mongo')).default;

  app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecret_studybuddy_dev_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // 'none' is required for cross-origin cookies (Vercel frontend → Render backend).
      // 'none' must be paired with secure:true (HTTPS-only).
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    }
  }));

  // Public health check endpoints (before rate limiting and auth)
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

  // Global rate limiting (after health checks)
  app.use(globalRateLimiter);

  // Passport initialization (needed for Google OAuth strategy only, no sessions)
  app.use(passport.initialize());

  // Debug middleware
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        console.log(`\n📨 ${req.method} ${req.path}`);
        console.log(`   Auth header: ${req.headers.authorization ? 'Bearer ...' : 'none'}`);
        console.log(`   Cookie token: ${req.cookies?.access_token ? 'present' : 'none'}`);
      }
      next();
    });
  }

  // Detailed health check (authenticated only)
  app.get('/api/health/detailed', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });

    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      },
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/todos', todoRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notices', noticeRoutes);
  app.use('/api/chat', chatRoutes); // Adheres to API endpoint structure for ai rate limiting
  app.use('/api/users', userRoutes);
  app.use('/api/faqs', faqRoutes);
  app.use('/api/timer', timerRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/friends', friendsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/username', usernameRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/news', newsRoutes);
  app.use('/api/waitlist', waitlistRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/upload', uploadRoutes);

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global error handler:', err);

    if (res.headersSent) {
      console.warn('⚠️  Headers already sent, skipping error response');
      return next(err);
    }

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

  const PORT = process.env.PORT || 3001;

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use`);
      console.log(`\n💡 To fix this, run one of these commands:`);
      console.log(`   1. lsof -ti:${PORT} | xargs kill -9`);
      console.log(`   2. pkill -f "tsx watch server/index.ts"`);
      console.log(`   3. npm run clean\n`);
      process.exit(1);
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📱 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'MongoDB Connected' : '⚠️  Not configured'}`);
    console.log(`🔐 Auth: JWT (access + refresh tokens)`);
    console.log(
      `🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' ? 'Configured' : '⚠️  Not configured'}`
    );
  });

  // Keep-alive ping for Render free tier
  startKeepAlive();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} received, shutting down gracefully...`);

    try {
      await closeMongoDb();
      httpServer.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
