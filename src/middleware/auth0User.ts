import { Request, Response, NextFunction } from 'express';
import { findOrCreateUser } from '../services/userService';
import { User } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';

interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

export const ensureUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sub = req.auth?.payload.sub;
    if (!sub) {
      return res.status(401).json({ error: 'No sub in token' });
    }

    // Skip client credentials
    if (String(sub).includes('@clients')) {
      console.log('Skipping client credentials in middleware');
      return next();
    }

    const user = await findOrCreateUser(String(sub));
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in ensureUser middleware:', error);
    res.status(500).json({ error: 'Error processing user' });
  }
}; 