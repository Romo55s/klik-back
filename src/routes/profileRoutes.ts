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
  getProfileByUsername
} from '../controllers/profileController';

const router = express.Router();

// Protected routes - require authentication
router.post('/', createProfile);
router.get('/me', getProfile);
router.put('/me', updateProfile);
router.delete('/me', deleteProfile);

// Admin routes (requires authentication)
router.get('/admin/all', getAllProfiles);
router.get('/admin/:id', getProfileById);

export default router; 