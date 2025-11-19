# Cloudinary Setup Guide

## Overview
Cloudinary is now integrated for storing all images including profile pictures, general images, and favicon.

## Setup Instructions

### 1. Create Cloudinary Account
1. Go to https://cloudinary.com/users/register/free
2. Sign up for a free account
3. After login, go to Dashboard

### 2. Get Your Credentials
From your Cloudinary Dashboard, copy:
- **Cloud Name** (e.g., `dxyz123abc`)
- **API Key** (e.g., `123456789012345`)
- **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123`)

### 3. Update Environment Variables

#### Local Development (.env)
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Production (Vercel)
Add these to your Vercel project environment variables:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 4. Upload Favicon to Cloudinary

#### Option A: Manual Upload
1. Go to Cloudinary Dashboard → Media Library
2. Upload `public/favicon.svg`
3. Copy the URL (e.g., `https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v1234567890/favicon.svg`)
4. Update `index.html`:
   ```html
   <link rel="icon" type="image/svg+xml" href="YOUR_CLOUDINARY_URL" />
   ```

#### Option B: Keep Local (Recommended)
The favicon is already optimized locally. For best performance, keep it in `/public/favicon.svg`.

## Features Implemented

### 1. Profile Picture Upload
- Automatic face detection and cropping
- Resized to 500x500px
- Stored in `studybuddy/profiles` folder
- 5MB file size limit
- Formats: JPG, JPEG, PNG, WebP

### 2. General Image Upload
- Stored in `studybuddy/images` folder
- 10MB file size limit
- Formats: JPG, JPEG, PNG, WebP, GIF

### 3. Image Management
- Automatic optimization
- CDN delivery worldwide
- Easy deletion via API

## API Endpoints

### Upload Profile Picture
```
POST /api/upload/profile
Content-Type: multipart/form-data
Body: { image: File }
```

### Upload General Image
```
POST /api/upload/image
Content-Type: multipart/form-data
Body: { image: File }
```

### Delete Image
```
DELETE /api/upload/image/:publicId
```

## Usage in React Components

### Profile Picture Upload
```tsx
import ImageUpload from '@/components/ImageUpload';

function ProfileSettings() {
  const handleUpload = (url: string) => {
    console.log('Uploaded image URL:', url);
    // Update user profile with new avatar URL
  };

  return (
    <ImageUpload
      type="profile"
      currentImage={user?.avatar}
      onUploadComplete={handleUpload}
    />
  );
}
```

### General Image Upload
```tsx
<ImageUpload
  type="image"
  onUploadComplete={(url) => console.log('Image URL:', url)}
/>
```

## Folder Structure in Cloudinary
```
studybuddy/
├── profiles/          # Profile pictures (500x500, face-cropped)
├── images/            # General images
└── favicon.svg        # (Optional) Favicon
```

## Benefits
- ✅ Automatic image optimization
- ✅ Global CDN delivery
- ✅ Face detection for profile pictures
- ✅ Format conversion (WebP support)
- ✅ Responsive image delivery
- ✅ Easy image management
- ✅ Free tier: 25GB storage, 25GB bandwidth/month

## Testing
1. Start your development server
2. Go to a page with image upload
3. Select an image file
4. Check the console for upload status
5. Verify image appears in Cloudinary dashboard

## Troubleshooting

### Upload fails with 401 error
- Check your API credentials in `.env`
- Ensure credentials match your Cloudinary dashboard

### Image not appearing
- Check browser console for errors
- Verify the returned URL is accessible
- Check Cloudinary dashboard for uploaded files

### File size errors
- Profile pictures: max 5MB
- General images: max 10MB
- Compress images before uploading if needed

## Free Tier Limits
- Storage: 25GB
- Bandwidth: 25GB/month
- Transformations: 25 credits/month
- More than enough for most applications!

## Next Steps
1. Add your Cloudinary credentials to `.env`
2. Test profile picture upload in onboarding
3. (Optional) Upload favicon to Cloudinary
4. Add credentials to Vercel environment variables
5. Deploy and test in production
