import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
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
import { setupSocketHandlers } from './socket/handlers';
import { keepAliveService } from './utils/keepAlive';
import { initializeDatabase } from './utils/initDatabase';
import { initMongoDB, scheduleBackups, closeMongoDB } from './utils/databaseSync';
import { bodySizeGuard, securityHeaders } from './middleware/security';
import { rateLimiter } from './lib/rateLimiter';

dotenv.config();

const prisma = new PrismaClient();

// Initialize database before starting server
async function startServer() {
  // Initialize database schema if needed
  await initializeDatabase();

  // Initialize MongoDB backup (optional)
  const mongoConnected = await initMongoDB();
  if (mongoConnected) {
    // Schedule automatic backups every 24 hours
    scheduleBackups(24);
  }

  const app = express();

  // Trust proxy - required for secure cookies behind Render's proxy
  app.set('trust proxy', 1);

  const httpServer = createServer(app);

  // CORS configuration - support multiple origins
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL || 'https://studybuddyone.vercel.app',
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

  // Rate limiting for API routes
  app.use('/api/', rateLimiter({ 
    maxRequests: 100, 
    windowMs: 60000,
    message: 'Too many requests, please try again later'
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      store: new PrismaSessionStore(prisma, {
        checkPeriod: 2 * 60 * 1000, // Clean expired sessions every 2 minutes
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }),
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days - persistent login like Facebook/Instagram
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Health check endpoint (minimal info for public)
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
    });
  });

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

  // Socket.io setup
  setupSocketHandlers(io);

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
    console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : '⚠️  Not configured'}`);
    console.log(
      `🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' ? 'Configured' : '⚠️  Not configured'}`
    );
    console.log(
      `☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' ? 'Configured' : '⚠️  Not configured'}\n`
    );

    // Start keep-alive service to prevent Render from spinning down
    keepAliveService.start();
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    keepAliveService.stop();
    closeMongoDB();
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\n\n🛑 SIGINT received, shutting down gracefully...');
    keepAliveService.stop();
    closeMongoDB();
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
