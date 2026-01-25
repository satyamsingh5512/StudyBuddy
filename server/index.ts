// Load environment variables FIRST - must be at the very top
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import { Server } from 'socket.io';
import MongoStore from 'connect-mongo';

import './config/passport';
import authRoutes from './routes/auth';
import todoRoutes from './routes/todos';
import reportRoutes from './routes/reports';
import noticeRoutes from './routes/notices';
import aiRoutes from './routes/ai';
import userRoutes from './routes/users';
import faqRoutes from './routes/faqs';
import uploadRoutes from './routes/upload';
import timerRoutes from './routes/timer';
import scheduleRoutes from './routes/schedule';
import friendsRoutes from './routes/friends';
import messagesRoutes from './routes/messages';
import usernameRoutes from './routes/username';
import backupRoutes from './routes/backup';
import newsRoutes from './routes/news';
import healthRoutes from './routes/health';
import { setupSocketHandlers } from './socket/handlers';
import { setupEnhancedChatHandlers } from './socket/chatHandlers';
import { getMongoDb, closeMongoDb } from './lib/mongodb';
import { bodySizeGuard, securityHeaders } from './middleware/security';
import { globalRateLimiter } from './middleware/rateLimiting';

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
    console.log('✅ MongoDB ready as primary database');
  }

  const app = express();

  // Trust proxy for production deployments
  app.set('trust proxy', 1);

  const httpServer = createServer(app);

  // CORS configuration - support multiple origins
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://sbd.satym.site',
    'https://studybuddyone.vercel.app',
    process.env.CLIENT_URL,
    // Support comma-separated additional origins from env
    ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
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
  app.use(bodySizeGuard(2 * 1024 * 1024)); // 2MB limit before parsing

  // OPTIMIZATION: Compression middleware (40% smaller responses)
  app.use(compression({
    filter: (req: any, res: any) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Balance between speed and compression
  }));

  app.use(express.json({ limit: '1mb' }));
  
  // Public health check endpoints (before rate limiting and auth)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
    });
  });

  // Global rate limiting (after health checks)
  app.use(globalRateLimiter);
  
  // Session configuration with MongoDB store
  const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds
    touchAfter: 24 * 3600, // Update session once per day (24 hours)
    autoRemove: 'native', // Let MongoDB handle expired session removal
    crypto: {
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    },
  });

  // Log session store events for debugging
  sessionStore.on('create', (sessionId) => {
    console.log('📝 Session created:', sessionId);
  });

  sessionStore.on('touch', (sessionId) => {
    console.log('👆 Session touched:', sessionId);
  });

  sessionStore.on('destroy', (sessionId) => {
    console.log('🗑️  Session destroyed:', sessionId);
  });

  sessionStore.on('error', (error) => {
    console.error('❌ Session store error:', error);
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      resave: false, // Don't save session if unmodified
      saveUninitialized: false, // Don't create session until something stored
      rolling: true, // Reset cookie maxAge on every response
      store: sessionStore,
      name: 'studybuddy.sid', // Custom session cookie name
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        httpOnly: true, // Prevent XSS attacks
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // CSRF protection
        path: '/', // Cookie available for all paths
        domain: undefined, // Let browser determine domain
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Middleware to ensure session is saved on every request
  app.use((req, res, next) => {
    if (req.isAuthenticated() && req.session) {
      // Touch the session to keep it alive
      req.session.touch();
    }
    next();
  });

  // Debug middleware - log all requests with session info
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        console.log(`\n📨 ${req.method} ${req.path}`);
        console.log(`   Session ID: ${req.sessionID}`);
        console.log(`   Authenticated: ${req.isAuthenticated()}`);
        console.log(`   User: ${req.user ? (req.user as any).email : 'none'}`);
        if (req.session.cookie) {
          console.log(`   Cookie expires: ${new Date(Date.now() + (req.session.cookie.maxAge || 0)).toISOString()}`);
        }
      }
      next();
    });
  }

  // Detailed health check (authenticated only)
  app.get('/api/health/detailed', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
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
  app.use('/api/ai', aiRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/faqs', faqRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/timer', timerRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/friends', friendsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/username', usernameRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/news', newsRoutes);
  app.use('/api/health', healthRoutes);

  // Global error handler (must be after all routes)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global error handler:', err);
    
    // Ensure CORS headers are set even on error
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // Send error response
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  // Socket.io setup with enhanced chat handlers
  setupEnhancedChatHandlers(io);

  const PORT = process.env.PORT || 3001;

  // Add error handling for port conflicts
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
    console.log(
      `🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' ? 'Configured' : '⚠️  Not configured'}`
    );
    console.log(
      `☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' ? 'Configured' : '⚠️  Not configured'}\n`
    );
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    closeMongoDb();
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\n\n🛑 SIGINT received, shutting down gracefully...');
    closeMongoDb();
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
