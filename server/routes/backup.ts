import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { isAdmin } from '../middleware/admin';
import { getMongoDb } from '../lib/mongodb';
import fs from 'fs';
import path from 'path';

const router = Router();

// Export MongoDB data to JSON (admin only)
router.get('/export', isAuthenticated, isAdmin, async (req: any, res: any) => {
  try {
    console.log(`📦 MongoDB export triggered by admin ${req.user.id}`);
    
    const db = await getMongoDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Get all collections
    const collections = await db.listCollections().toArray();
    const backup: any = {
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
    const outputPath = path.join(process.cwd(), 'mongodb-backup.json');
    fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2));

    // Send file and clean up
    res.download(outputPath, `studybuddy-backup-${Date.now()}.json`, (err: Error | null) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get backup status
router.get('/status', isAuthenticated, async (req: any, res: any) => {
  try {
    const db = await getMongoDb();
    const connected = db !== null;
    
    res.json({
      mongodbConnected: connected,
      database: db?.databaseName || 'Not connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get backup status' });
  }
});

export default router;
