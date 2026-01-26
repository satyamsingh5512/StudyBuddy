"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const admin_1 = require("../middleware/admin");
const mongodb_1 = require("../lib/mongodb");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// Export MongoDB data to JSON (admin only)
router.get('/export', auth_1.isAuthenticated, admin_1.isAdmin, async (req, res) => {
    try {
        console.log(`📦 MongoDB export triggered by admin ${req.user.id}`);
        const db = await (0, mongodb_1.getMongoDb)();
        if (!db) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        // Get all collections
        const collections = await db.listCollections().toArray();
        const backup = {
            timestamp: new Date().toISOString(),
            database: db.databaseName,
            collections: {}
        };
        // Export each collection
        for (const collInfo of collections) {
            const collName = collInfo.name;
            const data = await db.collection(collName).find({}).toArray();
            backup.collections[collName] = data;
        }
        // Write to temporary file
        const outputPath = path_1.default.join(process.cwd(), 'mongodb-backup.json');
        fs_1.default.writeFileSync(outputPath, JSON.stringify(backup, null, 2));
        // Send file and clean up
        res.download(outputPath, `studybuddy-backup-${Date.now()}.json`, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up file after download
            try {
                fs_1.default.unlinkSync(outputPath);
            }
            catch (e) {
                console.error('Cleanup error:', e);
            }
        });
    }
    catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
});
// Get backup status
router.get('/status', auth_1.isAuthenticated, async (req, res) => {
    try {
        const db = await (0, mongodb_1.getMongoDb)();
        const connected = db !== null;
        res.json({
            mongodbConnected: connected,
            database: db?.databaseName || 'Not connected',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get backup status' });
    }
});
exports.default = router;
