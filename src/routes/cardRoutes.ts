import express from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import {
  createCard,
  getCards,
  getCard,
  updateCard,
  deleteCard,
  associateCard,
  getUserCards,
  deactivateCard,
  generateCardQR
} from '../controllers/cardController';

const router = express.Router();

// All routes require authentication
router.post('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => createCard(req, res));
router.get('/', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getCards(req, res));
router.get('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getCard(req, res));
router.put('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => updateCard(req, res));
router.delete('/:id', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => deleteCard(req, res));

// Generate QR code for a new card
router.post('/generate-qr', generateCardQR);

// Associate a card with the current user
router.post('/associate', associateCard);

// Get all cards for the current user
router.get('/my-cards', getUserCards);

// Deactivate a card
router.put('/:card_id/deactivate', deactivateCard);

export default router; 