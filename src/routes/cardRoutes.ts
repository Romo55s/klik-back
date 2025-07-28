import express from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { checkAdmin } from '../middleware/checkAdmin';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import {
  createCard,
  getUserCard,
  activateUserCard,
  deactivateCard,
  claimCard,
  getAllCards,
  getCardByIdAdmin,
  adminActivateCard,
  adminDeactivateCard
} from '../controllers/cardController';

const router = express.Router();

// All routes require authentication
router.use(checkJwt);
router.use(ensureUser);

// Card routes - simplified to 1 user = 1 card
router.post('/', createCard);
router.get('/', getUserCard); // Get user's single card
router.post('/:cardId/activate', activateUserCard);
router.post('/:cardId/deactivate', deactivateCard);
router.post('/claim', claimCard);

// Admin card routes (require admin authentication)
router.get('/admin/all', checkAdmin, getAllCards);
router.get('/admin/:cardId', checkAdmin, getCardByIdAdmin);
router.post('/admin/:cardId/activate', checkAdmin, adminActivateCard);
router.post('/admin/:cardId/deactivate', checkAdmin, adminDeactivateCard);

export default router; 