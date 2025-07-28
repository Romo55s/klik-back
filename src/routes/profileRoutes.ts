import express from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
  getAllProfiles,
  getProfileById,
  getProfileByUsername,
  addLink,
  removeLink,
  getLinks,
  getUserLinks,
  uploadBackgroundImage,
  getSocialMediaPlatforms,
  addSocialMediaLink,
  removeSocialMediaLink
} from '../controllers/profileController';

const router = express.Router();

// Protected routes - require authentication
router.post('/', createProfile);

// Link management routes (must come before /me routes to avoid conflicts)
router.get('/links', getLinks);
router.post('/links', addLink);
router.delete('/links/:linkName', removeLink);

// Profile management routes
router.get('/me', getProfile);
router.put('/me', updateProfile);
router.delete('/me', deleteProfile);

// Social media routes
router.get('/social-platforms', getSocialMediaPlatforms);
router.post('/social-links', addSocialMediaLink);
router.delete('/social-links/:platform', removeSocialMediaLink);

// Background image upload (requires multer middleware)
router.post('/background-image', uploadBackgroundImage);

// Admin routes (requires authentication)
router.get('/admin/all', getAllProfiles);
router.get('/admin/:id', getProfileById);

export default router; 