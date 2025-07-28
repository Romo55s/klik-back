import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import express, { Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import cardRoutes from './routes/cardRoutes';
import userRoutes from './routes/userRoutes';
import profileRoutes from './routes/profileRoutes';
import adminRoutes from './routes/adminRoutes';
import imageRoutes from './routes/imageRoutes';

import { checkJwt } from './middleware/auth';
import { ensureUser } from './middleware/auth0User';
import { checkAdmin } from './middleware/checkAdmin';
import { testConnection } from './config/database';
import { User } from './interfaces/user.interface';
import { 
  getProfileByUsername, 
  getUserLinks, 
  getProfile, 
  updateProfile, 
  deleteProfile, 
  getLinks, 
  addLink, 
  removeLink, 
  createProfile 
} from './controllers/profileController';
import qrRoutes from './routes/qrRoutes';
import scanLogRoutes from './routes/scanLogRoutes';

// Create Express app
const app = express();

// Initialize OAuth2 client for Google Drive setup
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/google/callback'
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Google OAuth setup routes (for getting refresh token) - ADMIN ONLY
app.get('/auth/setup', checkJwt, ensureUser, checkAdmin, (req, res) => {
  res.send(`
    <h1>Google OAuth 2.0 Setup (Admin Only)</h1>
    <p>Click the button below to authorize Google Drive access:</p>
    <a href="/auth/google" style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      Authorize Google Drive
    </a>
    <br><br>
    <p><strong>Make sure you have set these in your .env file:</strong></p>
    <ul>
      <li>GOOGLE_CLIENT_ID</li>
      <li>GOOGLE_CLIENT_SECRET</li>
    </ul>
    <br><br>
    <h3>Debug Info:</h3>
    <p><strong>Client ID:</strong> ${process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing'}</p>
    <p><strong>Client Secret:</strong> ${process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}</p>
    <p><strong>Redirect URI:</strong> http://localhost:3000/auth/google/callback</p>
    <p><strong>Make sure this exact URI is in your Google Cloud Console!</strong></p>
    <br><br>
    <p><strong>🔒 This page is protected - Admin access only</strong></p>
  `);
});

app.get('/auth/google', checkJwt, ensureUser, checkAdmin, (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent'
  });
  
  console.log('🔗 Admin user redirecting to Google OAuth...');
  console.log('📋 Auth URL:', authUrl);
  console.log('📋 Redirect URI being sent:', 'http://localhost:3000/auth/google/callback');
  res.redirect(authUrl);
});

app.get('/auth/google/callback', checkJwt, ensureUser, checkAdmin, async (req, res) => {
  try {
    const { code } = req.query;
    
    console.log('🔍 Callback received with query params:', req.query);
    
    if (!code) {
      console.error('❌ No authorization code received');
      return res.status(400).send('Authorization code not received');
    }

    console.log('🔄 Exchanging authorization code for tokens...');
    console.log('📋 Code:', code);
    console.log('📋 Client ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
    console.log('📋 Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
    
    try {
      const { tokens } = await oauth2Client.getToken(code as string);

      console.log('✅ Tokens received successfully!');
      console.log('📋 Refresh Token:', tokens.refresh_token);
      console.log('📋 Access Token:', tokens.access_token?.substring(0, 20) + '...');
      console.log('📋 Token Type:', tokens.token_type);
      console.log('📋 Expires In:', tokens.expiry_date);

      // Set the tokens on the OAuth client
      oauth2Client.setCredentials(tokens);

      // Test the connection
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const about = await drive.about.get({ fields: 'user' });
      
      console.log('✅ Google Drive connection test successful!');
      console.log('👤 Connected as:', about.data.user?.emailAddress);

      res.send(`
        <h1>✅ OAuth Setup Complete!</h1>
        <h2>Your Refresh Token:</h2>
        <textarea style="width: 100%; height: 100px; font-family: monospace;" readonly>${tokens.refresh_token}</textarea>
        
        <h2>Add this to your .env file:</h2>
        <textarea style="width: 100%; height: 60px; font-family: monospace;" readonly>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</textarea>
        
        <h2>Connection Test:</h2>
        <p>✅ Connected as: ${about.data.user?.emailAddress}</p>
        
        <h2>Next Steps:</h2>
        <ol>
          <li>Copy the refresh token above</li>
          <li>Add it to your .env file</li>
          <li>Restart your backend server</li>
          <li>Close this browser tab</li>
        </ol>
        
        <p><strong>⚠️ Keep this refresh token secure - it's like a password!</strong></p>
      `);

    } catch (tokenError) {
      console.error('❌ Error exchanging code for tokens:', tokenError);
      console.error('❌ Token error details:', {
        message: tokenError instanceof Error ? tokenError.message : 'Unknown error',
        stack: tokenError instanceof Error ? tokenError.stack : undefined
      });
      
      res.status(500).send(`
        <h1>❌ Token Exchange Error</h1>
        <p><strong>Error:</strong> ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}</p>
        <p><strong>Details:</strong> Check your server console for more information.</p>
        <br>
        <h3>Troubleshooting:</h3>
        <ul>
          <li>Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your .env file</li>
          <li>Verify the redirect URI in Google Cloud Console matches: http://localhost:3000/auth/google/callback</li>
          <li>Check that your Google Cloud project has the Google Drive API enabled</li>
        </ul>
      `);
    }

  } catch (error) {
    console.error('❌ General error in callback:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    res.status(500).send(`
      <h1>❌ General Error</h1>
      <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p><strong>Details:</strong> Check your server console for more information.</p>
    `);
  }
});

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

// Admin routes (must come BEFORE other routes to avoid conflicts)
app.use('/api/admin', adminRoutes);

// User routes
app.use('/api/users', userRoutes);

// Protected profile routes - explicit routes to avoid conflicts
app.get('/api/profile/me', checkJwt, ensureUser, getProfile);
app.put('/api/profile/me', checkJwt, ensureUser, updateProfile);
app.delete('/api/profile/me', checkJwt, ensureUser, deleteProfile);
app.get('/api/profile/links', checkJwt, ensureUser, getLinks);
app.post('/api/profile/links', checkJwt, ensureUser, addLink);
app.delete('/api/profile/links/:linkName', checkJwt, ensureUser, removeLink);
app.post('/api/profile', checkJwt, ensureUser, createProfile);

// Profile routes - public routes (must come AFTER protected routes to avoid conflicts)
app.get('/api/profile/:username', getProfileByUsername);
app.get('/api/profile/:username/links', getUserLinks);

// Card routes (all protected)
app.use('/api/cards', checkJwt, ensureUser, cardRoutes);

// QR verification routes (public)
app.use('/api/qr', qrRoutes);

// Scan log routes (protected)
app.use('/api/scan-logs', checkJwt, ensureUser, scanLogRoutes);

// Image management routes (protected)
app.use('/api/images', checkJwt, ensureUser, imageRoutes);

// Debug endpoint to check current user status
app.get('/api/debug/user', checkJwt, ensureUser, (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'Current user info',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

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