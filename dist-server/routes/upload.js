"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cloudinary_1 = require("../config/cloudinary");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// Upload profile picture
router.post('/profile', auth_1.isAuthenticated, cloudinary_1.uploadProfile.single('image'), async (req, res) => {
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
    }
    catch (error) {
        console.error('Profile upload error:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});
// Upload general image
router.post('/image', auth_1.isAuthenticated, cloudinary_1.uploadImage.single('image'), async (req, res) => {
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
    }
    catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});
// Delete image
router.delete('/image/:publicId', auth_1.isAuthenticated, async (req, res) => {
    try {
        const { publicId } = req.params;
        await (0, cloudinary_1.deleteImage)(publicId);
        res.json({ success: true, message: 'Image deleted successfully' });
    }
    catch (error) {
        console.error('Image deletion error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});
exports.default = router;
