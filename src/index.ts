import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import express, { Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cardRoutes from './routes/cardRoutes';
import userRoutes from './routes/userRoutes';
import profileRoutes from './routes/profileRoutes';
import { checkJwt } from './middleware/auth';
import { ensureUser } from './middleware/auth0User';
import { testConnection } from './config/database';
import { User } from './interfaces/user.interface';
import { getProfileByUsername } from './controllers/profileController';
import qrRoutes from './routes/qrRoutes';

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/public', (req, res) => {
  res.json({ message: 'Public endpoint - no authentication required' });
});

// Extend Request type for this specific route
interface AuthenticatedRequest extends Request {
  user?: User;
}

app.get('/api/protected', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => {
  res.json({ 
    message: 'Protected endpoint - authentication required',
    user: req.user
  });
});

// User routes
app.use('/api/users', userRoutes);

// Profile routes - public route for getting profile by username
app.get('/api/profile/:username', getProfileByUsername);

// Protected profile routes
app.use('/api/profile', checkJwt, ensureUser, profileRoutes);

// Card routes (all protected)
app.use('/api/cards', checkJwt, ensureUser, cardRoutes);

// QR verification routes (public)
app.use('/api/qr', qrRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;

// Initialize database connection and start server
async function startServer() {
  try {
    // Test database connection
    await testConnection();

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 