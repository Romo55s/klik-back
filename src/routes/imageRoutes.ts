import express from 'express';
import { 
  uploadBackgroundImage,
  uploadGeneralImage,
  deleteImage, 
  updateBackgroundImage, 
  removeBackgroundImage,
  getImageInfo,
  getUserProfile,
  upload 
} from '../controllers/imageController';

const router = express.Router();

// Upload background image (saves to profile)
router.post('/background', upload.single('image'), uploadBackgroundImage);

// Upload general image (for gallery, etc.)
router.post('/general', upload.single('image'), uploadGeneralImage);

// Delete image from Google Drive
router.delete('/delete', deleteImage);

// Update background image (replace existing)
router.put('/background', upload.single('image'), updateBackgroundImage);

// Remove background image from profile
router.delete('/background', removeBackgroundImage);

// Get image info
router.get('/info', getImageInfo);

// Get user's profile with image URLs
router.get('/profile', getUserProfile);

export default router; 