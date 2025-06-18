import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { User, UserRole } from '../interfaces/user.interface';
import { generateUniqueUsername } from '../controllers/profileController';

export const generateProfileUrl = (urlId: string): string => {
  const domain = process.env.FRONTEND_URL || 'https://yourdomain.com';
  return `${domain}/profile/${urlId}`;
};

export const findOrCreateUser = async (auth0Id: string, email?: string): Promise<User> => {
  try {
    // First try to find user by token_auth
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          token_auth: { $eq: auth0Id }
        })
      }
    });
    
    if (response.data?.data?.length > 0) {
      const user = response.data.data[0];
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      // If user exists but doesn't have a username, generate one
      if (!user.username) {
        updates.username = await generateUniqueUsername(user.email);
      }

      // If user exists but doesn't have a url_id_text, generate one
      if (!user.url_id_text) {
        updates.url_id_text = generateProfileUrl(updates.username || user.username);
      }

      if (Object.keys(updates).length > 1) { // More than just updated_at
        await db.put(`/users/${user.user_id}`, updates);
        console.log('✅ Updated existing user with username and/or URL:', updates);
        return { ...user, ...updates };
      }

      console.log('✅ Found existing user by token_auth:', auth0Id);
      return user;
    }

    // If not found by token_auth, try to find by email
    if (email) {
      const emailResponse = await db.get('/users', {
        params: {
          where: JSON.stringify({
            email: { $eq: email }
          })
        }
      });
      if (emailResponse.data?.data?.length > 0) {
        const user = emailResponse.data.data[0];
        const updates: any = {
          token_auth: auth0Id,
          updated_at: new Date().toISOString()
        };
        
        // If user exists but doesn't have a username, generate one
        if (!user.username) {
          updates.username = await generateUniqueUsername(user.email);
        }

        // If user exists but doesn't have a url_id_text, generate one
        if (!user.url_id_text) {
          updates.url_id_text = generateProfileUrl(updates.username || user.username);
        }

        await db.put(`/users/${user.user_id}`, updates);
        console.log('✅ Updated existing user:', updates);
        return { ...user, ...updates };
      }
    }

    // Create new user if not found
    const userId = uuidv4();
    const profileId = uuidv4();
    
    // Generate username from email
    const username = await generateUniqueUsername(email || '');
    const profileUrl = generateProfileUrl(username);

    const newUser: User = {
      user_id: userId,
      profile_id: profileId,
      username: username,
      url_id_text: profileUrl,
      email: email || '', // Ensure email is always a string
      token_auth: auth0Id, // Store the Auth0 ID
      role: 'user', // Add default role
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.post('/users', newUser);
    console.log('✅ Created new user with token_auth:', auth0Id);

    // Create profile
    const profile = {
      profile_id: profileId,
      user_id: userId,
      name: email?.split('@')[0] || username,
      bio: 'Welcome to my profile!',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.post('/profile', profile);
    console.log('✅ Created profile for user');

    return newUser;
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
    username: await generateUniqueUsername(email),
    profile_id: profileId,
    url_id_text: urlId,
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