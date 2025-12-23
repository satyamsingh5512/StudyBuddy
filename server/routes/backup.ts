import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { 
  fullBackupToMongo, 
  exportMongoToJSON,
  restoreFromMongo 
} from '../utils/databaseSync';

const router = Router();

// Manual backup trigger (admin only)
router.post('/backup/now', isAuthenticated, async (req: any, res: any) => {
  try {
    // TODO: Add admin check
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    console.log(`📦 Manual backup triggered by user ${req.user.id}`);
    const success = await fullBackupToMongo();

    if (success) {
      res.json({ 
        success: true, 
        message: 'Backup completed successfully',
        timestamp: new Date()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Backup failed' 
      });
    }
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Backup failed' });
  }
});

// Export MongoDB backup to JSON
router.get('/backup/export', isAuthenticated, async (req: any, res: any) => {
  try {
    // TODO: Add admin check

    const outputPath = './mongodb-backup.json';
    const success = await exportMongoToJSON(outputPath);

    if (success) {
      res.download(outputPath, 'studybuddy-backup.json', (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up file after download
        const fs = require('fs');
        fs.unlinkSync(outputPath);
      });
    } else {
      res.status(500).json({ error: 'Export failed' });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Restore from MongoDB (use with caution!)
router.post('/backup/restore', isAuthenticated, async (req: any, res: any) => {
  try {
    // TODO: Add admin check and confirmation

    console.log(`⚠️  Restore triggered by user ${req.user.id}`);
    const success = await restoreFromMongo();

    if (success) {
      res.json({ 
        success: true, 
        message: 'Restore completed successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Restore not implemented - use migration scripts' 
      });
    }
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Restore failed' });
  }
});

// Get backup status
router.get('/backup/status', isAuthenticated, async (req: any, res: any) => {
  try {
    // TODO: Query MongoDB for last backup timestamp
    res.json({
      mongodbConnected: true, // Check actual connection
      lastBackup: new Date(), // Get from MongoDB metadata
      nextScheduledBackup: new Date(Date.now() + 24 * 60 * 60 * 1000),
      backupInterval: '24 hours'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get backup status' });
  }
});

export default router;
