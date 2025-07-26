import express from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import {
  createCard,
  getUserCards,
  getUserCard,
  activateUserCard,
  deactivateCard,
  claimCard,
  createAdditionalCard,
  getCardsByProfile
} from '../controllers/cardController';

const router = express.Router();

// All routes require authentication
router.use(checkJwt);
router.use(ensureUser);

// Card routes
router.post('/', createCard);
router.get('/', getUserCards);
router.get('/:cardId', getUserCard);
router.post('/:cardId/activate', activateUserCard);
router.post('/:cardId/deactivate', deactivateCard);
router.post('/claim', claimCard);
router.post('/additional', createAdditionalCard);
router.get('/profile/:profileUsername', getCardsByProfile);

export default router; 