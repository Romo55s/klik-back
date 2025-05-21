import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

export type UserRole = 'user' | 'admin';

export interface User {
  user_id: string; // This will be a UUID
  email: string;
  profile_id?: string;
  url_id?: string;
  token_auth?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export const findOrCreateUser = async (auth0Sub: string, email?: string): Promise<User> => {
  try {
    // First try to find the user by token_auth (Auth0 sub)
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          token_auth: { $eq: auth0Sub }
        })
      }
    });

    // If user exists, return it
    if (response.data && response.data.length > 0) {
      console.log('Found existing user:', response.data[0]);
      return response.data[0];
    }

    // If not found, create a new user
    const now = new Date().toISOString();
    const user: User = {
      user_id: uuidv4(),
      email: email || `${auth0Sub}@auth0.com`,
      profile_id: uuidv4(),
      url_id: uuidv4(),
      token_auth: auth0Sub,
      role: 'user',
      created_at: now,
      updated_at: now
    };

    try {
      await db.post('/users', user);
      console.log('Created new user:', user);
      return user;
    } catch (error: any) {
      // If we get a conflict error, try to fetch the user again
      if (error.response?.status === 409) {
        console.log('User creation conflict, fetching existing user...');
        const retryResponse = await db.get('/users', {
          params: {
            where: JSON.stringify({
              token_auth: { $eq: auth0Sub }
            })
          }
        });
        
        if (retryResponse.data && retryResponse.data.length > 0) {
          console.log('Found user after conflict:', retryResponse.data[0]);
          return retryResponse.data[0];
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    throw error;
  }
};

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });
    return response.data && response.data.length > 0 ? response.data[0] : null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const whereClause = JSON.stringify({
      user_id: { $exists: true }
    });
    
    const response = await db.get('/users', {
      params: {
        where: whereClause
      }
    });
    return response.data || [];
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  try {
    const now = new Date().toISOString();
    const response = await db.put(`/users/${userId}`, {
      ...updates,
      updated_at: now
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User> {
  try {
    const now = new Date().toISOString();
    const response = await db.put(`/users/${userId}`, {
      role,
      updated_at: now
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const response = await db.get('/tables/users/rows', {
      params: {
        where: {
          email: { $eq: email }
        }
      }
    });
    return response.data[0] || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

export const createUser = async (email: string, tokenAuth: string): Promise<User> => {
  const userId = uuidv4();
  const profileId = uuidv4();
  const urlId = uuidv4();
  const now = new Date();

  const user: User = {
    user_id: userId,
    email,
    profile_id: profileId,
    url_id: urlId,
    token_auth: tokenAuth,
    role: 'user', // Default role
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  try {
    await db.post('/tables/users/rows', user);
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    await db.delete(`/tables/users/rows/${userId}`);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
};

export const isAdmin = async (userId: string): Promise<boolean> => {
  try {
    const user = await getUserById(userId);
    return user?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}; 