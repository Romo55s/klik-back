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
  getProfileById
} from '../controllers/profileController';

const router = express.Router();

// Profile routes (requires authentication)
router.post('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => createProfile(req, res));
router.get('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getProfile(req, res));
router.put('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => updateProfile(req, res));
router.delete('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => deleteProfile(req, res));

// Admin routes (requires authentication)
router.get('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getAllProfiles(req, res));
router.get('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getProfileById(req, res));

export default router; 