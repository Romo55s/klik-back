import express, { Request } from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { User } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import {
  createScanLog,
  getScanLogs,
  getScanLog,
  deleteScanLog,
  getAllScanLogs,
  getScanLogsByCard
} from '../controllers/scanLogController';

const router = express.Router();

// Extend Request type for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

// Scan log routes (requires authentication)
router.post('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => createScanLog(req, res));
router.get('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getScanLogs(req, res));
router.get('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getScanLog(req, res));
router.delete('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => deleteScanLog(req, res));

// Card-specific scan logs
router.get('/card/:card_id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getScanLogsByCard(req, res));

// Admin routes (requires authentication)
router.get('/admin/all', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getAllScanLogs(req, res));

export default router; 