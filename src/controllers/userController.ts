import { Response } from 'express';
import { Request } from 'express';
import { User, findOrCreateUser, updateUser, deleteUser as deleteUserService, getUserById, getAllUsers, updateUserRole as updateUserRoleService, UserRole, isAdmin } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import axios from 'axios';
import { getManagementToken } from '../services/auth0Service';

interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get a fresh management token
    const managementToken = await getManagementToken();

    // First, create the user in Auth0
    const auth0Response = await axios.post(
      `https://${process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '')}/api/v2/users`,
      {
        email,
        password,
        connection: 'Username-Password-Authentication',
        email_verified: true
      },
      {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Get the Auth0 user ID (sub)
    const auth0Sub = auth0Response.data.user_id;

    // Get the user's profile from Auth0 to get their picture and email
    const auth0UserResponse = await axios.get(
      `https://${process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '')}/api/v2/users/${auth0Sub}`,
      {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Now create the user in our database with the actual email from Auth0 if available
    const user = await findOrCreateUser(auth0Sub, auth0UserResponse.data.email);
    console.log('✅ User created/found:', user);

    // Create profile at the same time as user
    try {
      const profile = {
        profile_id: user.profile_id,
        user_id: user.user_id,
        name: auth0UserResponse.data.name || auth0UserResponse.data.email?.split('@')[0] || user.email.split('@')[0],
        bio: 'Welcome to my profile!',
        avatar_url: auth0UserResponse.data.picture || null,
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      // Create profile in the same transaction
      await db.post('/profile', profile);
      console.log('✅ Profile created');

      // Set up Auth0 permissions
      try {
        const permissionsResponse = await axios.post(
          `https://${process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '')}/api/v2/users/${auth0Sub}/permissions`,
          {
            permissions: [
              {
                resource_server_identifier: process.env.AUTH0_AUDIENCE,
                permission_name: 'read:profile'
              },
              {
                resource_server_identifier: process.env.AUTH0_AUDIENCE,
                permission_name: 'write:profile'
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${managementToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ Auth0 permissions granted:', permissionsResponse.data);
      } catch (permissionsError: any) {
        console.error('Error setting Auth0 permissions:', permissionsError.response?.data || permissionsError.message);
        // Don't throw here, we still want to return the created user and profile
        // Just log the error and continue
      }

      res.status(201).json({
        user,
        profile,
        message: 'User and profile created successfully'
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      // If profile creation fails, we should probably delete the user too
      try {
        await db.delete(`/users/${user.user_id}`);
        console.log('❌ User deleted due to profile creation failure');
      } catch (deleteError) {
        console.error('Error deleting user after profile creation failure:', deleteError);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.response?.status === 409) {
      return res.status(409).json({ error: 'User already exists' });
    }
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
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const adminId = req.auth?.payload.sub;
    if (!adminId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const isUserAdmin = await isAdmin(adminId);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updatedUser = await updateUserRoleService(id, role as UserRole);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Error updating user role' });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.payload.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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

export const getUser = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.payload.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const adminId = req.auth?.payload.sub;
    if (!adminId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const isUserAdmin = await isAdmin(adminId);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const success = await deleteUserService(id);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting user' });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // Call Auth0's logout endpoint
    await axios.post(
      `https://${process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '')}/v2/logout`,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        returnTo: process.env.AUTH0_LOGOUT_URL || 'http://localhost:3000'
      }
    );

    res.json({ message: 'Successfully logged out' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Error during logout' });
  }
}; 