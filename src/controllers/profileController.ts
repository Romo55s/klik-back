import { Response } from 'express';
import { Request } from 'express';
import { User } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { db } from '../config/database';

interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

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

    const profileResponse = await db.get(`/profile/${userId}`);
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

    const now = new Date().toISOString();
    const profileId = req.user?.profile_id;

    const profileResponse = await db.put(`/profile/${userId}`, {
      profile_id: profileId,
      user_id: userId,
      name: name || req.user?.email.split('@')[0],
      bio: bio || 'Welcome to my profile!',
      avatar_url: avatar_url || null,
      created_at: req.user?.created_at,
      updated_at: now
    });

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

    await db.delete(`/profile/${userId}`);
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