"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
require("./config/passport");
const auth_1 = __importDefault(require("./routes/auth"));
const todos_1 = __importDefault(require("./routes/todos"));
const reports_1 = __importDefault(require("./routes/reports"));
const notices_1 = __importDefault(require("./routes/notices"));
const ai_1 = __importDefault(require("./routes/ai"));
const users_1 = __importDefault(require("./routes/users"));
const faqs_1 = __importDefault(require("./routes/faqs"));
const upload_1 = __importDefault(require("./routes/upload"));
const handlers_1 = require("./socket/handlers");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
    },
});
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days - persistent login
        httpOnly: true,
        sameSite: 'lax',
    },
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
// Socket.io setup
(0, handlers_1.setupSocketHandlers)(io);
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📱 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : '⚠️  Not configured'}`);
    console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' ? 'Configured' : '⚠️  Not configured'}`);
    console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' ? 'Configured' : '⚠️  Not configured'}\n`);
});
