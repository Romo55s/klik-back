import { Request, Response, NextFunction } from 'express';
import { auth } from 'express-oauth2-jwt-bearer';
import { isAdmin } from '../services/userService';

// Debug logging
console.log('Auth0 Config in middleware:', {
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  audience: process.env.AUTH0_AUDIENCE,
  audience_management: process.env.AUTH0_MANAGEMENT_AUDIENCE
});

if (!process.env.AUTH0_ISSUER_BASE_URL || !process.env.AUTH0_AUDIENCE || !process.env.AUTH0_MANAGEMENT_AUDIENCE) {
  throw new Error('Missing required Auth0 configuration. Please check your .env file');
}

export const checkJwt = auth({
  audience: [process.env.AUTH0_AUDIENCE, process.env.AUTH0_MANAGEMENT_AUDIENCE] as [string, string],
  issuerBaseURL: 'https://' + process.env.AUTH0_ISSUER_BASE_URL,
});

export const checkRole = (role: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.auth?.payload.sub;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // For admin role, use our existing isAdmin function
      if (role === 'admin') {
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
          return res.status(403).json({ error: 'Admin access required' });
        }
      }
      // For user role, we just need to check if they're authenticated
      // since all authenticated users have the 'user' role by default
      
      next();
    } catch (error) {
      console.error('Error in checkRole middleware:', error);
      res.status(500).json({ error: 'Error checking role' });
    }
  };
}; 