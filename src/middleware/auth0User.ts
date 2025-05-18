import { Request, Response, NextFunction } from 'express';
import { findOrCreateUser } from '../services/userService';
import { User } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';

interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

export const ensureUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const sub = req.auth?.payload.sub;
    const email = req.auth?.payload.email;

    if (!sub) {
      return res.status(401).json({ error: 'No user ID in token' });
    }

    if (!email) {
      return res.status(401).json({ error: 'No email in token' });
    }

    const user = await findOrCreateUser(
      String(sub),
      String(email)
    );

    req.user = user;
    next();
  } catch (error) {
    console.error('Error in ensureUser middleware:', error);
    res.status(500).json({ error: 'Error processing user' });
  }
}; 