import express from 'express';
import { checkJwt } from '../middleware/auth';
import { ensureUser } from '../middleware/auth0User';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { 
  createUser, 
  getCurrentUser, 
  updateCurrentUser, 
  getUsers, 
  getUser, 
  deleteUser, 
  updateUserRole 
} from '../controllers/userController';
import { getCacheStats, clearUserInfoCache } from '../middleware/auth0User';

const router = express.Router();

// Admin routes (require admin role)
router.get('/admin/users', checkJwt, ensureUser, getUsers);
router.get('/admin/users/:userId', checkJwt, ensureUser, getUser);
router.delete('/admin/users/:userId', checkJwt, ensureUser, deleteUser);
router.put('/admin/users/:userId/role', checkJwt, ensureUser, updateUserRole);

// Current user routes (requires authentication)
router.get('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => getCurrentUser(req, res));
router.put('/me', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => updateCurrentUser(req, res));

// Cache monitoring routes (for development/debugging)
router.get('/cache/stats', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => {
  try {
    const stats = getCacheStats();
    res.json({
      message: 'Cache statistics',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Error getting cache stats' });
  }
});

router.post('/cache/clear', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => {
  try {
    clearUserInfoCache();
    res.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Error clearing cache' });
  }
});

export default router; 