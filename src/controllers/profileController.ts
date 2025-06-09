import { Response } from 'express';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { db } from '../config/database';
import axios from 'axios';
import { getManagementToken } from '../services/auth0Service';

export const createProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, bio, avatar_url } = req.body;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const now = new Date().toISOString();
    const profileId = req.user?.profile_id;

    const profile = {
      profile_id: profileId,
      user_id: userId,
      name: name || req.user?.email.split('@')[0],
      bio: bio || 'Welcome to my profile!',
      avatar_url: avatar_url || null,
      created_at: now,
      updated_at: now
    };

    const profileResponse = await db.post('/profile', profile);
    console.log('✅ Profile created:', profileResponse.data);

    res.status(201).json(profileResponse.data);
  } catch (error) {
    console.error('Error creating profile:', error);
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
    const { name, bio, avatar_url } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First, get the existing profile using where clause
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

    // Update only the provided fields, excluding profile_id (primary key)
    const updates = {
      user_id: userId,
      name: name || existingProfile.name,
      bio: bio || existingProfile.bio,
      avatar_url: avatar_url || existingProfile.avatar_url,
      created_at: existingProfile.created_at, // Keep the original creation date
      updated_at: now
    };

    // Use PUT to update the profile
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