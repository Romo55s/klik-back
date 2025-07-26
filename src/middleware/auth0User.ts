import { Request, Response, NextFunction } from 'express';
import { findOrCreateUser } from '../services/userService';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import axios from 'axios';
import { db } from '../config/database';
import { Auth0Payload, Auth0UserInfo } from '../interfaces/auth0.interface';

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

    // Get user info from Auth0
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '');
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    let auth0UserInfo: Auth0UserInfo | null = null;
    try {
      const userInfoResponse = await axios.get(
        `https://${issuerBaseUrl}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      auth0UserInfo = {
        email: userInfoResponse.data.email,
        picture: userInfoResponse.data.picture,
        name: userInfoResponse.data.name,
        nickname: userInfoResponse.data.nickname
      };

      console.log('Auth0 user info:', {
        sub,
        ...auth0UserInfo
      });
    } catch (error) {
      console.error('Error fetching Auth0 user info:', error);
      // Continue with basic user creation if Auth0 info can't be fetched
    }

    // Find or create user with available info
    const user = await findOrCreateUser(
      String(sub), 
      auth0UserInfo?.email || (req.auth?.payload as Auth0Payload)?.email,
      auth0UserInfo?.nickname
    );

    // Update token_auth if it's not set or different
    if (user.token_auth !== sub) {
      try {
        await db.put(`/users/${user.user_id}`, {
          ...user,
          token_auth: sub,
          updated_at: new Date().toISOString()
        });
        console.log('✅ Updated user token_auth with Auth0 sub:', sub);
      } catch (error) {
        console.error('Error updating token_auth:', error);
      }
    }

    // Only proceed with profile management if we have Auth0 info
    if (auth0UserInfo) {
      try {
        // Check if profile exists using where clause
        const profileResponse = await db.get('/profile', {
          params: {
            where: JSON.stringify({
              user_id: { $eq: user.user_id }
            })
          }
        });
        
        if (!profileResponse.data?.data?.length) {
          // Create profile with Auth0 info
          const profile = {
            profile_id: user.profile_id,
            user_id: user.user_id,
            name: auth0UserInfo.name || auth0UserInfo.email.split('@')[0],
            username: auth0UserInfo.nickname || auth0UserInfo.email.split('@')[0],
            bio: 'Welcome to my profile!',
            avatar_url: auth0UserInfo.picture || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await db.post('/profile', profile);
          console.log('✅ Profile created with Auth0 info');
        } else {
          const profile = profileResponse.data.data[0];
          // Only update if there are changes
          if (profile.name !== auth0UserInfo.name || profile.avatar_url !== auth0UserInfo.picture) {
            // Update profile directly in the database
            const updates = {
              user_id: user.user_id,
              name: profile.name, // Keep existing name
              bio: profile.bio, // Keep existing bio
              avatar_url: auth0UserInfo.picture || profile.avatar_url,
              created_at: profile.created_at,
              updated_at: new Date().toISOString()
            };

            await db.put(`/profile/${profile.profile_id}`, updates);
            console.log('✅ Profile updated with Auth0 info');
          }
        }
      } catch (error) {
        console.error('Error managing profile:', error);
        // Don't throw here, we still want to return the user
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error in ensureUser middleware:', error);
    res.status(500).json({ error: 'Error processing user' });
  }
}; 