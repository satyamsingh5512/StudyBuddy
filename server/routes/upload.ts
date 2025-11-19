import { Router } from 'express';
import { uploadProfile, uploadImage, deleteImage } from '../config/cloudinary';
import { isAuthenticated } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = Router();

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

export default router;
