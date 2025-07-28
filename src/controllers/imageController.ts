import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { googleDriveService } from '../services/googleDriveService';
import { db } from '../config/database';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload background image and save to profile
export const uploadBackgroundImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    console.log(`🖼️ Uploading background image for user ${userId}`);

    // Upload to Google Drive
    const imageUrl = await googleDriveService.uploadBackgroundImage(userId, filePath);

    // Clean up local file
    fs.unlinkSync(filePath);

    // Get user's profile ID
    const userResponse = await db.get(`/users/${userId}`);
    const profileId = userResponse.data?.data?.[0]?.profile_id;

    if (!profileId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get current profile
    const profileResponse = await db.get(`/profile/${profileId}`);
    const currentProfile = profileResponse.data?.data?.[0];

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Update profile with background image URL (exclude primary key)
    const updatedProfile = {
      avatar_url: currentProfile.avatar_url,
      background_image: imageUrl,
      bio: currentProfile.bio,
      created_at: currentProfile.created_at,
      links: currentProfile.links,
      name: currentProfile.name,
      qr_code_url: currentProfile.qr_code_url,
      updated_at: new Date().toISOString(),
      user_id: currentProfile.user_id
    };

    await db.put(`/profile/${profileId}`, updatedProfile);

    console.log(`✅ Background image uploaded and saved to profile: ${imageUrl}`);

    res.status(201).json({
      success: true,
      message: 'Background image uploaded successfully',
      data: {
        imageUrl,
        originalName,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error uploading background image:', error);
    
    // Clean up local file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to upload background image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Upload general image (for gallery, etc.)
export const uploadGeneralImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    console.log(`🖼️ Uploading general image for user ${userId}`);

    // Upload to Google Drive
    const imageUrl = await googleDriveService.uploadGeneralImage(userId, filePath);

    // Clean up local file
    fs.unlinkSync(filePath);

    console.log(`✅ General image uploaded: ${imageUrl}`);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        imageUrl,
        originalName,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error uploading general image:', error);
    
    // Clean up local file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete image from Google Drive
export const deleteImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`🗑️ Deleting image for user ${userId}: ${imageUrl}`);

    // Extract file ID from Google Drive URL
    const fileId = extractFileIdFromUrl(imageUrl);
    if (!fileId) {
      return res.status(400).json({ error: 'Invalid Google Drive URL' });
    }

    await googleDriveService.deleteFile(fileId);

    console.log(`✅ Image deleted successfully: ${fileId}`);

    res.json({
      success: true,
      message: 'Image deleted successfully',
      data: {
        deletedFileId: fileId,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error deleting image:', error);
    res.status(500).json({
      error: 'Failed to delete image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update background image (replace existing)
export const updateBackgroundImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`🔄 Updating background image for user ${userId}`);

    // Get user's profile ID
    const userResponse = await db.get(`/users/${userId}`);
    const profileId = userResponse.data?.data?.[0]?.profile_id;

    if (!profileId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get current profile
    const profileResponse = await db.get(`/profile/${profileId}`);
    const currentProfile = profileResponse.data?.data?.[0];

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Delete old background image if it exists
    if (currentProfile.background_image) {
      const oldFileId = extractFileIdFromUrl(currentProfile.background_image);
      if (oldFileId) {
        try {
          await googleDriveService.deleteFile(oldFileId);
          console.log(`🗑️ Old background image deleted: ${oldFileId}`);
        } catch (deleteError) {
          console.warn(`⚠️ Could not delete old background image: ${deleteError}`);
        }
      }
    }

    // Upload new background image
    const filePath = req.file.path;
    const newImageUrl = await googleDriveService.uploadBackgroundImage(userId, filePath);

    // Clean up local file
    fs.unlinkSync(filePath);

    // Update profile with new background image URL (exclude primary key)
    const updatedProfile = {
      avatar_url: currentProfile.avatar_url,
      background_image: newImageUrl,
      bio: currentProfile.bio,
      created_at: currentProfile.created_at,
      links: currentProfile.links,
      name: currentProfile.name,
      qr_code_url: currentProfile.qr_code_url,
      updated_at: new Date().toISOString(),
      user_id: currentProfile.user_id
    };

    await db.put(`/profile/${profileId}`, updatedProfile);

    console.log(`✅ Background image updated successfully: ${newImageUrl}`);

    res.json({
      success: true,
      message: 'Background image updated successfully',
      data: {
        newImageUrl,
        oldImageUrl: currentProfile.background_image,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error updating background image:', error);
    
    // Clean up local file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to update background image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove background image from profile
export const removeBackgroundImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`🗑️ Removing background image for user ${userId}`);

    // Get user's profile ID
    const userResponse = await db.get(`/users/${userId}`);
    const profileId = userResponse.data?.data?.[0]?.profile_id;

    if (!profileId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get current profile
    const profileResponse = await db.get(`/profile/${profileId}`);
    const currentProfile = profileResponse.data?.data?.[0];

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Delete background image from Google Drive if it exists
    if (currentProfile.background_image) {
      const fileId = extractFileIdFromUrl(currentProfile.background_image);
      if (fileId) {
        try {
          await googleDriveService.deleteFile(fileId);
          console.log(`🗑️ Background image deleted from Google Drive: ${fileId}`);
        } catch (deleteError) {
          console.warn(`⚠️ Could not delete background image from Google Drive: ${deleteError}`);
        }
      }
    }

    // Remove background image URL from profile (exclude primary key)
    const updatedProfile = {
      avatar_url: currentProfile.avatar_url,
      background_image: null,
      bio: currentProfile.bio,
      created_at: currentProfile.created_at,
      links: currentProfile.links,
      name: currentProfile.name,
      qr_code_url: currentProfile.qr_code_url,
      updated_at: new Date().toISOString(),
      user_id: currentProfile.user_id
    };

    await db.put(`/profile/${profileId}`, updatedProfile);

    console.log('✅ Background image removed from profile');

    res.json({
      success: true,
      message: 'Background image removed successfully'
    });

  } catch (error) {
    console.error('❌ Error removing background image:', error);
    res.status(500).json({
      error: 'Failed to remove background image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get image info
export const getImageInfo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageUrl } = req.query;
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`📋 Getting image info for user ${userId}: ${imageUrl}`);

    // Extract file ID from Google Drive URL
    const fileId = extractFileIdFromUrl(imageUrl);
    if (!fileId) {
      return res.status(400).json({ error: 'Invalid Google Drive URL' });
    }

    const fileInfo = await googleDriveService.getFileInfo(fileId);

    console.log(`✅ Image info retrieved: ${fileId}`);

    res.json({
      success: true,
      data: {
        fileId,
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        createdTime: fileInfo.createdTime,
        webViewLink: fileInfo.webViewLink,
        directUrl: imageUrl
      }
    });

  } catch (error) {
    console.error('❌ Error getting image info:', error);
    res.status(500).json({
      error: 'Failed to get image info',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user's profile with image URLs
export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`📋 Getting profile for user ${userId}`);

    // Get user's profile ID
    const userResponse = await db.get(`/users/${userId}`);
    const profileId = userResponse.data?.data?.[0]?.profile_id;

    if (!profileId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get profile with image URLs
    const profileResponse = await db.get(`/profile/${profileId}`);
    const profile = profileResponse.data?.data?.[0];

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ Profile retrieved with image URLs');

    res.json({
      success: true,
      data: {
        profile,
        images: {
          background: profile.background_image,
          qrCode: profile.qr_code_url
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to extract file ID from Google Drive URL
function extractFileIdFromUrl(url: string): string | null {
  try {
    // Handle different Google Drive URL formats
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9-_]+)/, // Standard sharing URL
      /id=([a-zA-Z0-9-_]+)/, // Direct download URL
      /\/uc\?export=view&id=([a-zA-Z0-9-_]+)/ // Direct view URL
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting file ID:', error);
    return null;
  }
}

// Export multer middleware for use in routes
export { upload }; 