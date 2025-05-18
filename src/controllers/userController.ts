import { Response } from 'express';
import { Request } from 'express';
import { User, findOrCreateUser, updateUser, deleteUser, getUserById, getAllUsers, updateUserRole as updateUserRoleService, UserRole } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, picture } = req.body;
    const auth0Sub = req.auth?.payload.sub;

    if (!auth0Sub) {
      return res.status(401).json({ error: 'No Auth0 sub in token' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const now = new Date().toISOString();
    const userId = uuidv4();
    const profileId = uuidv4();
    const urlId = uuidv4();

    // Create user
    const user = {
      user_id: userId,
      email,
      profile_id: profileId,
      url_id: urlId,
      token_auth: auth0Sub,
      role: 'user', // Default role
      created_at: now,
      updated_at: now
    };

    const userResponse = await db.post('/users', user);
    console.log('✅ User created:', userResponse.data);

    // Create profile
    const profile = {
      profile_id: profileId,
      user_id: userId,
      name: name || email.split('@')[0],
      bio: 'Welcome to my profile!',
      avatar_url: picture || null,
      created_at: now,
      updated_at: now
    };

    const profileResponse = await db.post('/profile', profile);
    console.log('✅ Profile created:', profileResponse.data);

    res.status(201).json({
      user: userResponse.data,
      profile: profileResponse.data
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
};

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user profile
    const profileResponse = await db.get(`/profile/${req.user.user_id}`);
    
    res.json({
      user: req.user,
      profile: profileResponse.data
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
};

export const updateCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { email, name, bio, avatar_url } = req.body;
    const now = new Date().toISOString();

    // Update user if email is provided
    let updatedUser = req.user;
    if (email) {
      const userResponse = await db.put(`/users/${req.user.user_id}`, {
        email,
        updated_at: now
      });
      updatedUser = userResponse.data;
    }

    // Update profile
    const profileResponse = await db.put(`/profile/${req.user.user_id}`, {
      profile_id: req.user.profile_id,
      user_id: req.user.user_id,
      name: name || updatedUser.email.split('@')[0],
      bio: bio || 'Welcome to my profile!',
      avatar_url: avatar_url || null,
      created_at: req.user.created_at,
      updated_at: now
    });

    res.json({
      user: updatedUser,
      profile: profileResponse.data
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
};

export const deleteCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Delete user's profile first
    await db.delete(`/profile/${req.user.user_id}`);
    console.log('✅ Profile deleted');

    // Delete user
    await db.delete(`/users/${req.user.user_id}`);
    console.log('✅ User deleted');

    res.json({ message: 'User and profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
};

// Admin routes
export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    const updatedUser = await updateUserRoleService(id, role as UserRole);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Error updating user role' });
  }
};

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await getAllUsers();
    
    // Get profiles for all users
    const profiles = await Promise.all(
      users.map(user => 
        db.get(`/profile/${user.user_id}`)
          .then(response => response.data)
          .catch(() => null)
      )
    );

    const usersWithProfiles = users.map((user, index) => ({
      user,
      profile: profiles[index]
    }));

    res.json(usersWithProfiles);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
};

export const getUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's profile
    const profileResponse = await db.get(`/profile/${user.user_id}`);
    
    res.json({
      user,
      profile: profileResponse.data
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
}; 