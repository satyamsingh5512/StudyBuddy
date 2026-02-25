import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { isAuthenticated } from '../middleware/auth.js';
import { collections } from '../db/collections.js';

const router = Router();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Store file in memory; send directly to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
});

router.use(isAuthenticated);

/**
 * POST /api/upload/avatar
 * Accepts: multipart/form-data with field `avatar`
 * Returns: { avatar: cloudinary_url }
 */
router.post('/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const userId = (req.user as any)._id!.toString();

        // Upload to Cloudinary via stream
        const secureUrl = await new Promise<string>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'studybuddy/avatars',
                    public_id: `avatar_${userId}`,
                    overwrite: true,
                    transformation: [
                        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                        { quality: 'auto', fetch_format: 'auto' },
                    ],
                },
                (error, result) => {
                    if (error || !result) return reject(error ?? new Error('Upload failed'));
                    resolve(result.secure_url);
                }
            );
            stream.end(req.file!.buffer);
        });

        // Persist to MongoDB
        await (await collections.users).updateOne(
            { _id: (req.user as any)._id },
            { $set: { avatar: secureUrl, avatarType: 'upload', updatedAt: new Date() } }
        );

        res.json({ avatar: secureUrl });
    } catch (error: any) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

/**
 * DELETE /api/upload/avatar
 * Resets avatar to generated initial
 */
router.delete('/avatar', async (req, res) => {
    try {
        await (await collections.users).updateOne(
            { _id: (req.user as any)._id },
            { $set: { avatar: undefined, avatarType: 'generated', updatedAt: new Date() } }
        );
        res.json({ avatar: null });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to reset avatar' });
    }
});

export default router;
