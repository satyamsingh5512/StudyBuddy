import { Router } from 'express';
import { uploadProfile, uploadImage, uploadFormFile, deleteImage } from '../config/cloudinary';
import { isAuthenticated } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { uploadRateLimiter } from '../middleware/rateLimiting';

const prisma = new PrismaClient();

const router = Router();

// Apply upload rate limiter to all upload routes
router.use(uploadRateLimiter);

// Upload profile picture
router.post('/profile', isAuthenticated, uploadProfile.single('image'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = req.file.path;
    const publicId = req.file.filename;

    // Update user's avatar in database
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: imageUrl },
    });

    res.json({
      success: true,
      url: imageUrl,
      publicId,
      user,
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Upload general image
router.post('/image', isAuthenticated, uploadImage.single('image'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = req.file.path;
    const publicId = req.file.filename;

    res.json({
      success: true,
      url: imageUrl,
      publicId,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Delete image
router.delete('/image/:publicId', isAuthenticated, async (req: any, res: any) => {
  try {
    const { publicId } = req.params;
    await deleteImage(publicId);
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Upload form file (public endpoint for form responses)
router.post('/form-file', uploadFormFile.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = req.file.path;
    const publicId = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const fileType = req.file.mimetype;

    res.json({
      success: true,
      url: fileUrl,
      publicId,
      originalName,
      fileSize,
      fileType,
    });
  } catch (error: any) {
    console.error('Form file upload error:', error);
    
    // Handle file size limits
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 50MB limit' });
    }
    
    // Handle unsupported file types
    if (error.message?.includes('Invalid file type')) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }
    
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

export default router;
