import { User } from '../services/userService';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      user?: User;
    }
  }
}

export {}; 