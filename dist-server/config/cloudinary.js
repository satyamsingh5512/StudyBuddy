"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBase64Image = exports.deleteImage = exports.uploadImage = exports.uploadProfile = void 0;
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const multer_1 = __importDefault(require("multer"));
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Storage for profile pictures
const profileStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: 'studybuddy/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
    },
});
// Storage for general images
const imageStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: 'studybuddy/images',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
});
// Multer upload instances
exports.uploadProfile = (0, multer_1.default)({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});
exports.uploadImage = (0, multer_1.default)({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
    try {
        await cloudinary_1.v2.uploader.destroy(publicId);
    }
    catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
    }
};
exports.deleteImage = deleteImage;
// Helper function to upload base64 image
const uploadBase64Image = async (base64String, folder = 'studybuddy/images') => {
    try {
        const result = await cloudinary_1.v2.uploader.upload(base64String, {
            folder,
            resource_type: 'auto',
        });
        return {
            url: result.secure_url,
            publicId: result.public_id,
        };
    }
    catch (error) {
        console.error('Error uploading base64 image:', error);
        throw new Error('Failed to upload image');
    }
};
exports.uploadBase64Image = uploadBase64Image;
exports.default = cloudinary_1.v2;
