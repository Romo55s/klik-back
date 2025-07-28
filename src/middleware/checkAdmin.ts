import { Request, Response, NextFunction } from 'express';
import { isAdmin, getUserByEmail } from '../services/userService';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';

export const checkAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id; // This is the database user_id
    const userEmail = req.user?.email;

    console.log('🔍 checkAdmin middleware called');
    console.log('User ID:', userId);
    console.log('User Email:', userEmail);
    console.log('Full user object:', req.user);

    if (!userId && !userEmail) {
      console.log('❌ No user_id or email found in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('🔍 Checking if user is admin...');
    let admin = false;
    
    // Try with user ID first
    if (userId) {
      admin = await isAdmin(userId);
      console.log('Admin check result (by ID):', admin);
    }
    
    // If not admin by ID, try with email
    if (!admin && userEmail) {
      console.log('🔍 Trying admin check with email...');
      const user = await getUserByEmail(userEmail);
      admin = user?.role === 'admin';
      console.log('Admin check result (by email):', admin);
    }

    if (!admin) {
      console.log('❌ User is not admin');
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('✅ User is admin, proceeding...');
    next();
  } catch (error) {
    console.error('❌ Error in checkAdmin middleware:', error);
    res.status(500).json({ error: 'Error checking admin status' });
  }
}; 