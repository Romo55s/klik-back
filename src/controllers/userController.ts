import { Response } from 'express';
import { User, UserRole } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { findOrCreateUser, updateUser, deleteUser as deleteUserService, getUserById, getAllUsers, updateUserRole as updateUserRoleService, isAdmin } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import axios from 'axios';
import { getManagementToken } from '../services/auth0Service';

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
    const user = await findOrCreateUser(auth0Sub, auth0UserResponse.data.email, auth0UserResponse.data.nickname);
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

    // Update profile - only include updatable fields
    const profileResponse = await db.put(`/profile/${req.user.user_id}`, {
      name: name || updatedUser.email.split('@')[0],
      bio: bio || 'Welcome to my profile!',
      avatar_url: avatar_url || null,
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

    // Get the user record to get the Auth0 ID and profile_id
    const userResponse = await db.get(`/users/${req.user.user_id}`);
    if (!userResponse.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profileId = userResponse.data?.data?.[0]?.profile_id;
    const auth0UserId = userResponse.data?.data?.[0]?.token_auth;

    // First delete the user from Auth0
    if (auth0UserId) {
      try {
        const managementToken = await getManagementToken();
        const auth0Response = await axios.delete(
          `https://${process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '')}/api/v2/users/${auth0UserId}`,
          {
            headers: {
              'Authorization': `Bearer ${managementToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ User deleted from Auth0:', auth0Response.data);
      } catch (auth0Error) {
        console.error('Error deleting user from Auth0:', auth0Error);
        // Continue with local deletion even if Auth0 deletion fails
      }
    } else {
      console.error('Could not find Auth0 user ID in token_auth');
    }

    // Delete user's cards if they exist
    try {
      const cardsResponse = await db.get('/card', {
        params: {
          where: JSON.stringify({
            user_id: { $eq: req.user.user_id }
          })
        }
      });

      if (cardsResponse.data?.data?.length > 0) {
        for (const card of cardsResponse.data.data) {
          await db.delete(`/card/${card.card_id}/${req.user.user_id}`);
        }
        console.log('✅ User cards deleted');
      } else {
        console.log('No cards found for user');
      }
    } catch (cardsError) {
      console.error('Error deleting user cards:', cardsError);
      // Continue with other deletions even if cards deletion fails
    }

    // Delete user's profile using the profile_id
    if (profileId) {
      try {
        await db.delete(`/profile/${profileId}`);
        console.log('✅ Profile deleted');
      } catch (profileError) {
        console.error('Error deleting profile:', profileError);
        // Continue with user deletion even if profile deletion fails
      }
    } else {
      console.log('No profile found for user');
    }

    // Delete user
    await db.delete(`/users/${req.user.user_id}`);
    console.log('✅ User deleted from database');

    res.json({ message: 'User, profile, and cards deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
};

// Admin routes
export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
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

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id; // Use database user_id instead of Auth0 ID
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all users - use created_at field to get all users
    const usersResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          created_at: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });
    const users = usersResponse.data?.data || [];
    
    // Get profiles for all users
    const profiles = await Promise.all(
      users.map((user: any) => 
        db.get(`/profile/${user.user_id}`)
          .then(response => response.data)
          .catch(() => null)
      )
    );

    const usersWithProfiles = users.map((user: any, index: number) => ({
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

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First delete the user from Auth0
    try {
      const auth0Response = await axios.delete(
        `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AUTH0_MANAGEMENT_API_TOKEN}`,
          },
        }
      );
      console.log('✅ User deleted from Auth0:', auth0Response.data);
    } catch (auth0Error) {
      console.error('Error deleting user from Auth0:', auth0Error);
      // Continue with local deletion even if Auth0 deletion fails
    }

    // Delete user's profile first
    const profileResponse = await db.get('/profile', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    if (profileResponse.data?.data?.length) {
      const profileId = profileResponse.data.data[0].profile_id;
      await db.delete(`/profile/${profileId}`);
      console.log('✅ Profile deleted');
    }

    // Then delete the user
    await db.delete(`/users/${userId}`);
    console.log('✅ User deleted from database');

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
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

// Admin dashboard stats
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Admin: Getting dashboard stats');

    // Get total users - use created_at field to get all users
    const usersResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          created_at: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });
    const totalUsers = usersResponse.data?.data?.length || 0;

    // Get total profiles - count from users (since each user should have a profile)
    const totalProfiles = totalUsers; // Assuming each user has a profile

    // Get total cards - use created_at field to get all cards
    const cardsResponse = await db.get('/card', {
      params: {
        where: JSON.stringify({
          created_at: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });
    const totalCards = cardsResponse.data?.data?.length || 0;
    const activeCards = cardsResponse.data?.data?.filter((card: any) => card.status === 'active').length || 0;

    // Get total scan logs - use scan_time field to get all scan logs
    const scanLogsResponse = await db.get('/scanlog', {
      params: {
        where: JSON.stringify({
          scan_time: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });
    const totalScans = scanLogsResponse.data?.data?.length || 0;

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsersResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          created_at: { $gte: sevenDaysAgo.toISOString() }
        })
      }
    });
    const recentUsers = recentUsersResponse.data?.data?.length || 0;

    const recentScansResponse = await db.get('/scanlog', {
      params: {
        where: JSON.stringify({
          created_at: { $gte: sevenDaysAgo.toISOString() }
        })
      }
    });
    const recentScans = recentScansResponse.data?.data?.length || 0;

    const stats = {
      users: {
        total: totalUsers,
        recent: recentUsers
      },
      profiles: {
        total: totalProfiles
      },
      cards: {
        total: totalCards,
        active: activeCards,
        inactive: totalCards - activeCards
      },
      scans: {
        total: totalScans,
        recent: recentScans
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ Admin: Dashboard stats retrieved');

    res.json(stats);
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Error getting dashboard stats' });
  }
}; 