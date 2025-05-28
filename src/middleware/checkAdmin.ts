import { Request, Response, NextFunction } from 'express';
import { isAdmin } from '../services/userService';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';

export const checkAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const admin = await isAdmin(userId);
    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Error in checkAdmin middleware:', error);
    res.status(500).json({ error: 'Error checking admin status' });
  }
}; 