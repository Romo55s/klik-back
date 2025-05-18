import express, { Request } from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { checkAdmin } from '../middleware/checkAdmin';
import { User } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import {
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
  getUsers,
  getUser,
  createUser,
  updateUserRole
} from '../controllers/userController';

const router = express.Router();

// Extend Request type for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

// Create user route (requires authentication)
router.post('/', checkJwt, (req: AuthenticatedRequest, res) => createUser(req, res));

// Current user routes (requires authentication)
router.get('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getCurrentUser(req, res));
router.put('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => updateCurrentUser(req, res));
router.delete('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => deleteCurrentUser(req, res));

// Admin routes (requires authentication and admin role)
router.get('/', checkJwt, ensureUser, checkAdmin, (req: AuthenticatedRequest, res) => getUsers(req, res));
router.get('/:id', checkJwt, ensureUser, checkAdmin, (req: AuthenticatedRequest, res) => getUser(req, res));
router.put('/:id/role', checkJwt, ensureUser, checkAdmin, (req: AuthenticatedRequest, res) => updateUserRole(req, res));

export default router; 