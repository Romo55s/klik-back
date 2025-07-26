import { Response, Request } from 'express';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { db } from '../config/database';
import axios from 'axios';
import { getManagementToken } from '../services/auth0Service';
import { v4 as uuidv4 } from 'uuid';
import { createCard, getCardByUserId, verifyCardForUser } from '../services/cardService';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';



export const createProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, bio, avatar_url, links } = req.body;
    const userId = req.user?.user_id;
    const userEmail = req.user?.email;

    console.log('👤 Creating profile for user:', {
      userId,
      userEmail,
      name,
      bio,
      avatar_url,
      links
    });

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const now = new Date().toISOString();
    const profileId = req.user?.profile_id;

    const profile = {
      profile_id: profileId,
      user_id: userId,
      name: name || userEmail.split('@')[0],
      bio: bio || 'Welcome to my profile!',
      avatar_url: avatar_url || null,
      links: links || {}, // Initialize with empty object if no links provided
      created_at: now,
      updated_at: now
    };

    console.log('📝 Creating profile with data:', profile);

    const profileResponse = await db.post('/profile', profile);
    console.log('✅ Profile created:', profileResponse.data);

    // Generate QR code for the user's profile URL
    try {
      // Get the user's profile URL from the users table
      const userResponse = await db.get(`/users/${userId}`);
      const urlIdText = userResponse.data?.data?.[0]?.url_id_text;
      if (urlIdText) {
        // Ensure qr-codes folder exists
        const qrFolder = path.join(__dirname, '../qr-codes');
        if (!fs.existsSync(qrFolder)) fs.mkdirSync(qrFolder);
        // Save QR code as PNG file
        const qrFilePath = path.join(qrFolder, `${userId}.png`);
        await QRCode.toFile(qrFilePath, urlIdText, { width: 300 });
        console.log('✅ QR code generated and saved at:', qrFilePath);
      } else {
        console.warn('⚠️  No url_id_text found for user, QR code not generated.');
      }
    } catch (qrError) {
      console.error('Error generating/saving QR code:', qrError);
    }

    res.status(201).json(profileResponse.data);
  } catch (error) {
    console.error('❌ Error creating profile:', error);
    res.status(500).json({ error: 'Error creating profile' });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use where clause to find profile by user_id
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    if (!profileResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profileResponse.data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { name, bio, avatar_url, username, links } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First, get the existing profile
    const existingProfileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    if (!existingProfileResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const existingProfile = existingProfileResponse.data.data[0];
    const now = new Date().toISOString();

    // Handle username update in users table if provided
    if (username) {
      // Check if the requested username is available
      const usernameCheckResponse = await db.get('/users', {
        params: {
          where: JSON.stringify({
            username: { $eq: username }
          })
        }
      });
      
      if (usernameCheckResponse.data?.data?.length) {
        return res.status(400).json({ error: 'Username is already taken' });
      }

      // Update username in users table
      await db.put(`/users/${userId}`, {
        username,
        updated_at: now
      });
    }

    // If avatar_url is provided, update it in Auth0
    if (avatar_url) {
      try {
        const managementToken = await getManagementToken();
        // Get the user's token_auth from the database to get the correct Auth0 ID
        const userResponse = await db.get(`/users/${userId}`);
        if (userResponse.data?.data?.[0]?.token_auth) {
          const auth0UserId = userResponse.data.data[0].token_auth;
          await axios.patch(
            `https://${process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '')}/api/v2/users/${auth0UserId}`,
            {
              picture: avatar_url
            },
            {
              headers: {
                'Authorization': `Bearer ${managementToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('✅ User picture updated in Auth0');
        } else {
          console.error('Could not find Auth0 user ID in token_auth');
        }
      } catch (auth0Error) {
        console.error('Error updating user picture in Auth0:', auth0Error);
        // Continue with local update even if Auth0 update fails
      }
    }

    // Update profile (without username)
    const updates = {
      user_id: existingProfile.user_id,
      name: name || existingProfile.name,
      bio: bio || existingProfile.bio,
      avatar_url: avatar_url || existingProfile.avatar_url,
      links: links !== undefined ? links : existingProfile.links, // Only update if links is provided
      created_at: existingProfile.created_at,
      updated_at: now
    };

    const profileResponse = await db.put(`/profile/${existingProfile.profile_id}`, updates);
    console.log('✅ Profile updated:', profileResponse.data);

    res.json(profileResponse.data);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
};

export const deleteProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First get the profile to get its profile_id
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    if (!profileResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileId = profileResponse.data.data[0].profile_id;
    await db.delete(`/profile/${profileId}`);
    console.log('✅ Profile deleted');

    res.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: 'Error deleting profile' });
  }
};

// Admin routes
export const getAllProfiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const response = await db.get('/profile');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Error fetching profiles' });
  }
};

export const getProfileById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const response = await db.get(`/profile/${id}`);
    
    if (!response.data) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
};

// New endpoint to get profile by URL ID
export const getProfileByUrl = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url_id } = req.params;

    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          url_id: { $eq: url_id }
        })
      }
    });

    if (!profileResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profileResponse.data.data[0];

    // Get user's cards if they exist
    let cards = [];
    try {
      const cardsResponse = await db.get('/card', {
        params: {
          where: JSON.stringify({
            user_id: { $eq: profile.user_id }
          })
        }
      });
      cards = cardsResponse.data?.data || [];
    } catch (error) {
      console.error('Error fetching cards:', error);
      // Continue without cards if there's an error
    }

    res.json({
      profile,
      cards
    });
  } catch (error) {
    console.error('Error fetching profile by URL:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
};

// Get profile by username
export const getProfileByUsername = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.params;

    // First get the user by username
    const userResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          username: { $eq: username }
        })
      }
    });

    if (!userResponse.data?.data?.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResponse.data.data[0];

    // Then get the profile
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: user.user_id }
        })
      }
    });

    if (!profileResponse.data?.data?.length) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const profile = profileResponse.data.data[0];

    // Get user's cards
    const cardsResponse = await db.get('/card', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: user.user_id }
        })
      }
    });

    const cards = cardsResponse.data?.data || [];

    res.json({
      user,
      profile,
      cards
    });
  } catch (error) {
    console.error('Error getting profile by username:', error);
    res.status(500).json({ message: 'Error getting profile' });
  }
};

// Add link to profile
export const addLink = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { linkName, linkUrl } = req.body;

    console.log('🔍 addLink called with:', { userId, linkName, linkUrl });

    if (!userId) {
      console.log('❌ User not authenticated');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!linkName || !linkUrl) {
      console.log('❌ Missing linkName or linkUrl:', { linkName, linkUrl });
      return res.status(400).json({ error: 'Link name and URL are required' });
    }

    console.log('🔍 Getting existing profile for userId:', userId);
    // Get existing profile
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    console.log('🔍 Profile response:', profileResponse.data);

    if (!profileResponse.data?.data?.length) {
      console.log('❌ Profile not found for userId:', userId);
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profileResponse.data.data[0];
    console.log('🔍 Found profile:', profile);
    
    // Handle case where links might be null, undefined, or an array of key-value objects
    let existingLinks: Record<string, string> = {};
    if (profile.links) {
      if (Array.isArray(profile.links)) {
        // Convert array of {key, value} objects to Record<string, string>
        profile.links.forEach((item: any) => {
          if (item.key && item.value) {
            existingLinks[item.key] = item.value;
          }
        });
      } else if (typeof profile.links === 'object') {
        existingLinks = profile.links as Record<string, string>;
      }
    }
    console.log('🔍 Existing links:', existingLinks);
    
    // Add new link
    existingLinks[linkName] = linkUrl;
    console.log('🔍 Updated links object:', existingLinks);

    // Update profile with new links - only include updatable fields
    // Convert links object to AstraDB map format
    const linksArray = Object.entries(existingLinks).map(([key, value]) => ({
      key: String(key),
      value: String(value)
    }));

    const updates = {
      user_id: profile.user_id,
      name: profile.name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      links: linksArray,
      created_at: profile.created_at,
      updated_at: new Date().toISOString()
    };

    console.log('🔍 About to update profile with:', updates);
    console.log('🔍 Profile ID for update:', profile.profile_id);
    
    const updatedProfile = await db.put(`/profile/${profile.profile_id}`, updates);
    console.log('✅ Link added to profile successfully:', { linkName, linkUrl });
    console.log('✅ Updated profile response:', updatedProfile.data);

    // Verify the update by fetching the profile again
    console.log('🔍 Verifying update by fetching profile again...');
    const verifyResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });
    console.log('🔍 Verification response:', verifyResponse.data);

    res.json(updatedProfile.data);
  } catch (error) {
    console.error('Error adding link:', error);
    res.status(500).json({ error: 'Error adding link' });
  }
};

// Remove link from profile
export const removeLink = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { linkName } = req.params;

    console.log('🔍 removeLink called with:', { userId, linkName });

    if (!userId) {
      console.log('❌ User not authenticated');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!linkName) {
      console.log('❌ Missing linkName:', linkName);
      return res.status(400).json({ error: 'Link name is required' });
    }

    console.log('🔍 Getting existing profile for userId:', userId);
    // Get existing profile
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    console.log('🔍 Profile response:', profileResponse.data);

    if (!profileResponse.data?.data?.length) {
      console.log('❌ Profile not found for userId:', userId);
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profileResponse.data.data[0];
    console.log('🔍 Found profile:', profile);
    
    // Handle case where links might be null, undefined, or an array of key-value objects
    let existingLinks: Record<string, string> = {};
    if (profile.links) {
      if (Array.isArray(profile.links)) {
        // Convert array of {key, value} objects to Record<string, string>
        profile.links.forEach((item: any) => {
          if (item.key && item.value) {
            existingLinks[item.key] = item.value;
          }
        });
      } else if (typeof profile.links === 'object') {
        existingLinks = profile.links as Record<string, string>;
      }
    }
    console.log('🔍 Existing links:', existingLinks);
    
    // Remove the link
    if (existingLinks[linkName]) {
      delete existingLinks[linkName];
      console.log('🔍 Link removed, updated links object:', existingLinks);
    } else {
      console.log('❌ Link not found:', linkName);
      return res.status(404).json({ error: 'Link not found' });
    }

    // Update profile with updated links - only include updatable fields
    // Convert links object to AstraDB map format
    const linksArray = Object.entries(existingLinks).map(([key, value]) => ({
      key: String(key),
      value: String(value)
    }));

    const updates = {
      user_id: profile.user_id,
      name: profile.name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      links: linksArray,
      created_at: profile.created_at,
      updated_at: new Date().toISOString()
    };

    console.log('🔍 About to update profile with:', updates);
    console.log('🔍 Profile ID for update:', profile.profile_id);
    
    const updatedProfile = await db.put(`/profile/${profile.profile_id}`, updates);
    console.log('✅ Link removed from profile successfully:', linkName);
    console.log('✅ Updated profile response:', updatedProfile.data);

    res.json(updatedProfile.data);
  } catch (error) {
    console.error('Error removing link:', error);
    res.status(500).json({ error: 'Error removing link' });
  }
};

// Get links for the authenticated user
export const getLinks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get profile to access links
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    if (!profileResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profileResponse.data.data[0];
    
    // Handle case where links might be null, undefined, or an array of key-value objects
    let links: Record<string, string> = {};
    if (profile.links) {
      if (Array.isArray(profile.links)) {
        // Convert array of {key, value} objects to Record<string, string>
        profile.links.forEach((item: any) => {
          if (item.key && item.value) {
            links[item.key] = item.value;
          }
        });
      } else if (typeof profile.links === 'object') {
        links = profile.links as Record<string, string>;
      }
    }

    res.json({ links });
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Error fetching links' });
  }
};

// Get links for a specific user by username (public endpoint)
export const getUserLinks = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // First get the user by username
    const userResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          username: { $eq: username }
        })
      }
    });

    if (!userResponse.data?.data?.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResponse.data.data[0];
    
    // Get profile to access links
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: user.user_id }
        })
      }
    });

    if (!profileResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profileResponse.data.data[0];
    
    // Handle case where links might be null, undefined, or an array of key-value objects
    let links: Record<string, string> = {};
    if (profile.links) {
      if (Array.isArray(profile.links)) {
        // Convert array of {key, value} objects to Record<string, string>
        profile.links.forEach((item: any) => {
          if (item.key && item.value) {
            links[item.key] = item.value;
          }
        });
      } else if (typeof profile.links === 'object') {
        links = profile.links as Record<string, string>;
      }
    }

    res.json({ 
      links,
      user: {
        username: user.username,
        name: profile.name,
        bio: profile.bio,
        avatar_url: profile.avatar_url
      }
    });
  } catch (error) {
    console.error('Error fetching user links:', error);
    res.status(500).json({ error: 'Error fetching user links' });
  }
};