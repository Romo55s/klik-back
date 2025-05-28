import express from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { checkAdmin } from '../middleware/checkAdmin';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { getAllUsers, updateUserRole } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import {
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
  getUsers,
  getUser,
  createUser,
  updateUserRole as updateUserRoleController,
  logout
} from '../controllers/userController';

const router = express.Router();

// Create user route (requires authentication)
router.post('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => createUser(req, res));

// Current user routes (requires authentication)
router.get('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getCurrentUser(req, res));
router.put('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => updateCurrentUser(req, res));
router.delete('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => deleteCurrentUser(req, res));

// Admin routes (requires authentication and admin role)
router.get('/', checkJwt, ensureUser, checkAdmin, (req: AuthenticatedRequest, res) => getUsers(req, res));
router.get('/:id', checkJwt, ensureUser, checkAdmin, (req: AuthenticatedRequest, res) => getUser(req, res));
router.put('/:id/role', checkJwt, ensureUser, checkAdmin, (req: AuthenticatedRequest, res) => updateUserRoleController(req, res));

// Logout route
router.post('/logout', checkJwt, logout);

export default router; 