import express from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { checkAdmin } from '../middleware/checkAdmin';
import { 
  getDashboardStats, 
  getUsers, 
  getUser, 
  deleteUser, 
  updateUserRole 
} from '../controllers/userController';
import { 
  getAllProfiles, 
  getProfileById 
} from '../controllers/profileController';
import { 
  getAllCards, 
  getCardByIdAdmin, 
  adminActivateCard, 
  adminDeactivateCard 
} from '../controllers/cardController';
import { 
  getAllScanLogs 
} from '../controllers/scanLogController';

const router = express.Router();

// Apply admin middleware to all routes
router.use(checkJwt, ensureUser, checkAdmin);

// Dashboard stats
router.get('/stats', getDashboardStats);

// User management
router.get('/users', getUsers);
router.get('/users/:userId', getUser);
router.delete('/users/:userId', deleteUser);
router.put('/users/:userId/role', updateUserRole);

// Profile management
router.get('/profiles', getAllProfiles);
router.get('/profiles/:id', getProfileById);

// Scan logs
router.get('/scans', getAllScanLogs);

// Card management
router.get('/cards', getAllCards);
router.get('/cards/:cardId', getCardByIdAdmin);
router.put('/cards/:cardId/activate', adminActivateCard);
router.put('/cards/:cardId/deactivate', adminDeactivateCard);

export default router; 