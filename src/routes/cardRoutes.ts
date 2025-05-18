import express, { Request } from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { User } from '../services/userService';
import {
  createCard,
  getCards,
  getCard,
  updateCard,
  deleteCard
} from '../controllers/cardController';

const router = express.Router();

// Extend Request type for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: User;
}

// All routes require authentication
router.post('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => createCard(req, res));
router.get('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getCards(req, res));
router.get('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getCard(req, res));
router.put('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => updateCard(req, res));
router.delete('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => deleteCard(req, res));

export default router; 