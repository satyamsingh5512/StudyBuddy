"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables FIRST - must be at the very top
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const connect_mongo_1 = __importDefault(require("connect-mongo"));
require("./config/passport");
const auth_1 = __importDefault(require("./routes/auth"));
const todos_1 = __importDefault(require("./routes/todos"));
const reports_1 = __importDefault(require("./routes/reports"));
const notices_1 = __importDefault(require("./routes/notices"));
const ai_1 = __importDefault(require("./routes/ai"));
const users_1 = __importDefault(require("./routes/users"));
const faqs_1 = __importDefault(require("./routes/faqs"));
const timer_1 = __importDefault(require("./routes/timer"));
const schedule_1 = __importDefault(require("./routes/schedule"));
const friends_1 = __importDefault(require("./routes/friends"));
const messages_1 = __importDefault(require("./routes/messages"));
const username_1 = __importDefault(require("./routes/username"));
const backup_1 = __importDefault(require("./routes/backup"));
const news_1 = __importDefault(require("./routes/news"));
const health_1 = __importDefault(require("./routes/health"));
const chatHandlers_1 = require("./socket/chatHandlers");
const mongodb_1 = require("./lib/mongodb");
const security_1 = require("./middleware/security");
const rateLimiting_1 = require("./middleware/rateLimiting");
// Initialize database before starting server
async function startServer() {
    // Initialize MongoDB connection
    const db = await (0, mongodb_1.getMongoDb)();
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
    }
    else {
        console.log('✅ MongoDB connected and ready');
        console.log('📊 Database: MongoDB (Native Driver)');
    }
    const app = (0, express_1.default)();
    // Trust proxy for production deployments
    app.set('trust proxy', 1);
    const httpServer = (0, http_1.createServer)(app);
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
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                // Allow requests with no origin (mobile apps, Postman, etc.)
                if (!origin)
                    return callback(null, true);
                if (allowedOrigins.includes(origin)) {
                    callback(null, true);
                }
                else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
        },
    });
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    }));
    // Security middleware
    app.use(security_1.securityHeaders);
    app.use((0, security_1.bodySizeGuard)(2 * 1024 * 1024)); // 2MB limit before parsing
    // OPTIMIZATION: Compression middleware (40% smaller responses)
    app.use((0, compression_1.default)({
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression_1.default.filter(req, res);
        },
        level: 6, // Balance between speed and compression
    }));
    app.use(express_1.default.json({ limit: '1mb' }));
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
    app.use(rateLimiting_1.globalRateLimiter);
    // Session configuration with MongoDB store
    const sessionStore = connect_mongo_1.default.create({
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
    app.use((0, express_session_1.default)({
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
    }));
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    // Middleware to ensure session is saved on every request
    app.use((req, _res, next) => {
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
                console.log(`   User: ${req.user ? req.user.email : 'none'}`);
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
    app.use('/api/auth', auth_1.default);
    app.use('/api/todos', todos_1.default);
    app.use('/api/reports', reports_1.default);
    app.use('/api/notices', notices_1.default);
    app.use('/api/ai', ai_1.default);
    app.use('/api/users', users_1.default);
    app.use('/api/faqs', faqs_1.default);
    app.use('/api/timer', timer_1.default);
    app.use('/api/schedule', schedule_1.default);
    app.use('/api/friends', friends_1.default);
    app.use('/api/messages', messages_1.default);
    app.use('/api/username', username_1.default);
    app.use('/api/backup', backup_1.default);
    app.use('/api/news', news_1.default);
    app.use('/api/health', health_1.default);
    // Global error handler (must be after all routes)
    app.use((err, req, res, next) => {
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
    // Socket.io setup with enhanced chat handlers (Redis caching + batch persistence)
    (0, chatHandlers_1.setupEnhancedChatHandlers)(io);
    const PORT = process.env.PORT || 3001;
    // Add error handling for port conflicts
    httpServer.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`\n❌ Error: Port ${PORT} is already in use`);
            console.log(`\n💡 To fix this, run one of these commands:`);
            console.log(`   1. lsof -ti:${PORT} | xargs kill -9`);
            console.log(`   2. pkill -f "tsx watch server/index.ts"`);
            console.log(`   3. npm run clean\n`);
            process.exit(1);
        }
        else {
            console.error('Server error:', error);
            process.exit(1);
        }
    });
    httpServer.listen(PORT, () => {
        console.log(`\n✅ Server running on http://localhost:${PORT}`);
        console.log(`📱 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
        console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'MongoDB Connected' : '⚠️  Not configured'}`);
        console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' ? 'Configured' : '⚠️  Not configured'}`);
    });
    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
        try {
            // Close Socket.IO connections first
            io.close(() => {
                console.log('✅ Socket.IO closed');
            });
            // Close MongoDB connection
            await (0, mongodb_1.closeMongoDb)();
            // Close HTTP server
            httpServer.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
            // Force exit after 10 seconds if graceful shutdown fails
            setTimeout(() => {
                console.error('⚠️  Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        }
        catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    // Handle uncaught exceptions
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
