import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import './config/passport';
import authRoutes from './routes/auth';
import todoRoutes from './routes/todos';
import reportRoutes from './routes/reports';
import noticeRoutes from './routes/notices';
import aiRoutes from './routes/ai';
import userRoutes from './routes/users';
import faqRoutes from './routes/faqs';
import uploadRoutes from './routes/upload';
import { setupSocketHandlers } from './socket/handlers';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days - persistent login
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-domain in production
      domain: process.env.NODE_ENV === 'production' ? undefined : undefined, // Let browser handle domain
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Socket.io setup
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

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
});
