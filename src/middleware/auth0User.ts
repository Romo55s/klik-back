import { Request, Response, NextFunction } from 'express';
import { findOrCreateUser } from '../services/userService';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import axios from 'axios';

export const ensureUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sub = req.auth?.payload.sub;
    const email = (req.auth?.payload['https://klik-auth-api/email'] || req.auth?.payload.email) as string | undefined;
    
    if (!sub) {
      return res.status(401).json({ error: 'No sub in token' });
    }

    // Skip client credentials
    if (String(sub).includes('@clients')) {
      console.log('Skipping client credentials in middleware');
      return next();
    }

    console.log('Auth0 payload:', {
      sub,
      email,
      payload: req.auth?.payload
    });

    const user = await findOrCreateUser(String(sub), email);
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in ensureUser middleware:', error);
    res.status(500).json({ error: 'Error processing user' });
  }
}; 