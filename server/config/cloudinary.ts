import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for profile pictures
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'studybuddy/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
  } as any,
});

// Storage for general images
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'studybuddy/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  } as any,
});

// Multer upload instances
export const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Storage for form file uploads (supports all file types)
const formFileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'studybuddy/form-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip'],
    resource_type: 'auto', // Auto-detect file type
  } as any,
});

export const uploadFormFile = multer({
  storage: formFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for form uploads
});

// Helper function to delete image from Cloudinary
export const deleteImage = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
};

// Helper function to upload base64 image
export const uploadBase64Image = async (
  base64String: string,
  folder: string = 'studybuddy/images'
): Promise<{ url: string; publicId: string }> => {
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder,
      resource_type: 'auto',
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error('Error uploading base64 image:', error);
    throw new Error('Failed to upload image');
  }
};

export default cloudinary;
