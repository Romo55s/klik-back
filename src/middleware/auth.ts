import { Request, Response, NextFunction } from 'express';
import { auth } from 'express-oauth2-jwt-bearer';

// Debug logging
console.log('Auth0 Config in middleware:', {
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  audience: process.env.AUTH0_AUDIENCE
});

if (!process.env.AUTH0_ISSUER_BASE_URL || !process.env.AUTH0_AUDIENCE) {
  throw new Error('Missing required Auth0 configuration. Please check your .env file');
}

export const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
});

export const checkRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.auth?.payload['https://your-namespace/roles'] as string[];
    
    if (!userRoles || !userRoles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}; 