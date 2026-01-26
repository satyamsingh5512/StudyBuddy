"use strict";
/**
 * MongoDB Connection Singleton - PRIMARY DATABASE
 *
 * OPTIMIZATION: Single connection pool reused across all requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectId = void 0;
exports.getMongoDb = getMongoDb;
exports.closeMongoDb = closeMongoDb;
exports.generateId = generateId;
exports.toObjectId = toObjectId;
exports.checkMongoHealth = checkMongoHealth;
const mongodb_1 = require("mongodb");
Object.defineProperty(exports, "ObjectId", { enumerable: true, get: function () { return mongodb_1.ObjectId; } });
let mongoClient = null;
let mongoDb = null;
let isConnecting = false;
/**
 * Get MongoDB database instance
 * Creates connection on first call, reuses thereafter
 */
async function getMongoDb() {
    // Return existing connection
    if (mongoDb) {
        return mongoDb;
    }
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
        // Wait for connection to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        return getMongoDb();
    }
    const MONGODB_URL = process.env.MONGODB_URI;
    if (!MONGODB_URL) {
        console.log('⚠️  MongoDB not configured (MONGODB_URI not set)');
        return null;
    }
    try {
        isConnecting = true;
        console.log('🔄 Connecting to MongoDB...');
        // Workaround for Node.js TLS issues with MongoDB Atlas
        mongoClient = new mongodb_1.MongoClient(MONGODB_URL, {
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 60000,
            serverSelectionTimeoutMS: 10000,
            // TLS configuration for compatibility
            tls: true,
            tlsAllowInvalidCertificates: true, // Temporary workaround
            tlsAllowInvalidHostnames: true,
        });
        await mongoClient.connect();
        mongoDb = mongoClient.db();
        console.log('✅ MongoDB connected');
        // Create indexes for fast queries
        await createMongoIndexes(mongoDb);
        return mongoDb;
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        if (error.message.includes('authentication failed')) {
            console.error('   → Check your MongoDB username and password');
            console.error('   → Verify credentials in MongoDB Atlas');
        }
        else if (error.message.includes('ENOTFOUND')) {
            console.error('   → Check your MongoDB cluster URL');
            console.error('   → Verify network connectivity');
        }
        else if (error.message.includes('IP')) {
            console.error('   → Add your IP address to MongoDB Atlas whitelist');
        }
        return null;
    }
    finally {
        isConnecting = false;
    }
}
/**
 * Close MongoDB connection
 * Called on server shutdown
 */
async function closeMongoDb() {
    if (mongoClient) {
        await mongoClient.close();
        mongoDb = null;
        mongoClient = null;
        console.log('✅ MongoDB connection closed');
    }
}
/**
 * Create MongoDB indexes for fast queries
 * Run once on connection
 */
async function createMongoIndexes(db) {
    try {
        // Users collection
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
        await db.collection('users').createIndex({ googleId: 1 }, { unique: true, sparse: true });
        await db.collection('users').createIndex({ totalPoints: -1 });
        await db.collection('users').createIndex({ resetToken: 1 }, { sparse: true });
        // Todos collection
        await db.collection('todos').createIndex({ userId: 1, createdAt: -1 });
        await db.collection('todos').createIndex({ userId: 1, completed: 1 });
        // Messages collections
        await db.collection('directMessages').createIndex({ senderId: 1, receiverId: 1, createdAt: -1 });
        await db.collection('directMessages').createIndex({ receiverId: 1, read: 1 });
        // Reports collection
        await db.collection('dailyReports').createIndex({ userId: 1, date: -1 });
        // Timer sessions
        await db.collection('timerSessions').createIndex({ userId: 1, completedAt: -1 });
        // Forms
        await db.collection('forms').createIndex({ ownerId: 1 });
        await db.collection('forms').createIndex({ customSlug: 1 }, { unique: true, sparse: true });
        // Form responses
        await db.collection('formResponses').createIndex({ formId: 1, submittedAt: -1 });
        // Friendships
        await db.collection('friendships').createIndex({ senderId: 1, receiverId: 1 }, { unique: true });
        await db.collection('friendships').createIndex({ receiverId: 1, status: 1 });
        // Sessions - for connect-mongo
        await db.collection('sessions').createIndex({ sid: 1 }, { unique: true });
        await db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
        console.log('✅ MongoDB indexes created');
    }
    catch (error) {
        console.error('⚠️  MongoDB index creation failed:', error);
        // Don't throw - indexes are optimization, not critical
    }
}
/**
 * Generate a new ObjectId as string
 */
function generateId() {
    return new mongodb_1.ObjectId().toString();
}
/**
 * Convert string ID to ObjectId
 */
function toObjectId(id) {
    return new mongodb_1.ObjectId(id);
}
/**
 * Health check for MongoDB
 */
async function checkMongoHealth() {
    try {
        const db = await getMongoDb();
        if (!db)
            return false;
        await db.admin().ping();
        return true;
    }
    catch (error) {
        return false;
    }
}
