"use strict";
/**
 * Express App Configuration (Vercel-compatible)
 * Separated from server/index.ts for Vercel serverless deployment
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const connect_mongo_1 = __importDefault(require("connect-mongo"));
require("./config/passport");
const auth_1 = __importDefault(require("./routes/auth"));
const todos_1 = __importDefault(require("./routes/todos"));
const reports_1 = __importDefault(require("./routes/reports"));
const notices_1 = __importDefault(require("./routes/notices"));
const ai_1 = __importDefault(require("./routes/ai"));
const users_1 = __importDefault(require("./routes/users"));
const faqs_1 = __importDefault(require("./routes/faqs"));
const upload_1 = __importDefault(require("./routes/upload"));
const timer_1 = __importDefault(require("./routes/timer"));
const schedule_1 = __importDefault(require("./routes/schedule"));
const friends_1 = __importDefault(require("./routes/friends"));
const messages_1 = __importDefault(require("./routes/messages"));
const username_1 = __importDefault(require("./routes/username"));
const backup_1 = __importDefault(require("./routes/backup"));
const news_1 = __importDefault(require("./routes/news"));
const health_1 = __importDefault(require("./routes/health"));
const chat_1 = __importDefault(require("./routes/chat"));
const security_1 = require("./middleware/security");
const rateLimiting_1 = require("./middleware/rateLimiting");
const app = (0, express_1.default)();
// Trust proxy for Vercel
app.set('trust proxy', 1);
// CORS configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://sbd.satym.site',
    'https://studybuddyone.vercel.app',
    process.env.CLIENT_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
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
app.use((0, security_1.bodySizeGuard)(2 * 1024 * 1024));
// Compression
app.use((0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    level: 6,
}));
app.use(express_1.default.json({ limit: '1mb' }));
// Health check endpoints
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
// Global rate limiting
app.use(rateLimiting_1.globalRateLimiter);
// Session configuration
const sessionStore = connect_mongo_1.default.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 30 * 24 * 60 * 60,
    touchAfter: 24 * 3600,
    autoRemove: 'native',
    crypto: {
        secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    },
});
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: sessionStore,
    name: 'studybuddy.sid',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        domain: undefined,
    },
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Touch session middleware
app.use((req, res, next) => {
    if (req.isAuthenticated() && req.session) {
        req.session.touch();
    }
    next();
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/todos', todos_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/notices', notices_1.default);
app.use('/api/ai', ai_1.default);
app.use('/api/users', users_1.default);
app.use('/api/faqs', faqs_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/timer', timer_1.default);
app.use('/api/schedule', schedule_1.default);
app.use('/api/friends', friends_1.default);
app.use('/api/messages', messages_1.default);
app.use('/api/username', username_1.default);
app.use('/api/backup', backup_1.default);
app.use('/api/news', news_1.default);
app.use('/api/health', health_1.default);
app.use('/api/chat', chat_1.default);
// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});
exports.default = app;
