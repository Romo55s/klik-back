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
  adminDeactivateCard,
  adminToggleCardStatus
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
router.put('/cards/:cardId/activate', adminActivateCard);
router.put('/cards/:cardId/deactivate', adminDeactivateCard);
router.put('/cards/:cardId/status', adminToggleCardStatus);
router.get('/cards/:cardId', getCardByIdAdmin);

// Test endpoint to verify admin routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes are working', timestamp: new Date().toISOString() });
});

export default router; 