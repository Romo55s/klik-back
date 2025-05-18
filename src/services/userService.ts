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

export async function findOrCreateUser(auth0Sub: string, email: string): Promise<User> {
  try {
    // Try to find existing user by token_auth (which stores the Auth0 sub)
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          token_auth: { $eq: auth0Sub }
        }),
        'allow-filtering': 'true'
      }
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
  } catch (error: any) {
    // If user doesn't exist, create new user
    if (error.response?.status === 404) {
      const now = new Date().toISOString();
      const newUser: User = {
        user_id: uuidv4(), // Generate a new UUID for user_id
        email,
        profile_id: uuidv4(),
        url_id: uuidv4(),
        token_auth: auth0Sub, // Store Auth0 sub in token_auth
        role: 'user', // Default role for new users
        created_at: now,
        updated_at: now
      };

      const createResponse = await db.post('/users', newUser);
      return createResponse.data;
    }
    throw error;
  }

  throw new Error('Unexpected error in findOrCreateUser');
}

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
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          user_id: { $exists: true }
        })
      }
    });
    return response.data || [];
  } catch (error) {
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

export async function deleteUser(userId: string): Promise<void> {
  try {
    await db.delete(`/users/${userId}`);
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

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await getUserById(userId);
    return user?.role === 'admin';
  } catch (error) {
    return false;
  }
} 