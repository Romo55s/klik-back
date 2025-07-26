import { Request, Response, NextFunction } from 'express';
import { findOrCreateUser } from '../services/userService';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import axios from 'axios';
import { db } from '../config/database';
import { Auth0Payload, Auth0UserInfo } from '../interfaces/auth0.interface';

// Cache interface for Auth0 user info
interface CachedUserInfo {
  data: Auth0UserInfo;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// In-memory cache for Auth0 user info
const userInfoCache = new Map<string, CachedUserInfo>();

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userInfoCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      userInfoCache.delete(key);
      console.log(`🗑️  Cleaned up expired cache entry for: ${key}`);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

// Function to get cached user info or fetch from Auth0
async function getCachedUserInfo(sub: string, accessToken: string, issuerBaseUrl: string): Promise<Auth0UserInfo | null> {
  const cacheKey = `${sub}:${accessToken.slice(-10)}`; // Use last 10 chars of token as part of key
  
  // Check cache first
  const cached = userInfoCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
    console.log(`📦 Using cached Auth0 user info for: ${sub}`);
    return cached.data;
  }

  // Fetch from Auth0 if not cached or expired
  try {
    console.log(`🌐 Fetching fresh Auth0 user info for: ${sub}`);
    const userInfoResponse = await axios.get(
      `https://${issuerBaseUrl}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const auth0UserInfo: Auth0UserInfo = {
      email: userInfoResponse.data.email,
      picture: userInfoResponse.data.picture,
      name: userInfoResponse.data.name,
      nickname: userInfoResponse.data.nickname
    };

    // Cache the result
    userInfoCache.set(cacheKey, {
      data: auth0UserInfo,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });

    console.log(`💾 Cached Auth0 user info for: ${sub}`);
    return auth0UserInfo;
  } catch (error) {
    console.error('Error fetching Auth0 user info:', error);
    
    // If we have cached data that's expired, use it as fallback
    if (cached) {
      console.log(`🔄 Using expired cached data as fallback for: ${sub}`);
      return cached.data;
    }
    
    return null;
  }
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

    // Get user info from Auth0 (with caching)
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '');
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    let auth0UserInfo: Auth0UserInfo | null = null;
    try {
      auth0UserInfo = await getCachedUserInfo(String(sub), accessToken, issuerBaseUrl!);
      
      if (auth0UserInfo) {
        console.log('Auth0 user info:', {
          sub,
          ...auth0UserInfo
        });
      }
    } catch (error) {
      console.error('Error in getCachedUserInfo:', error);
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

// Utility function to clear cache (useful for testing or manual cache management)
export const clearUserInfoCache = () => {
  const cacheSize = userInfoCache.size;
  userInfoCache.clear();
  console.log(`🧹 Cleared ${cacheSize} cached user info entries`);
};

// Utility function to get cache stats
export const getCacheStats = () => {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  
  for (const [key, value] of userInfoCache.entries()) {
    if (now - value.timestamp < value.ttl) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalEntries: userInfoCache.size,
    validEntries,
    expiredEntries,
    cacheTTL: CACHE_TTL / 1000, // in seconds
    cleanupInterval: CACHE_CLEANUP_INTERVAL / 1000 // in seconds
  };
}; 