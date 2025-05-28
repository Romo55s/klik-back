import { Request } from 'express';
import { User } from './user.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';

export interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
} 