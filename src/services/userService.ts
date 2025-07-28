import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { User, UserRole } from '../interfaces/user.interface';

export const generateProfileUrl = (urlId: string): string => {
  const domain = process.env.FRONTEND_URL || 'https://yourdomain.com';
  return `${domain}/profile/${urlId}`;
};

export const findOrCreateUser = async (auth0Id: string, email?: string, nickname?: string): Promise<User> => {
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

      // If user exists but doesn't have a username, use nickname or fallback
      if (!user.username) {
        updates.username = nickname || user.email?.split('@')[0] || 'user';
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
        
        // If user exists but doesn't have a username, use nickname or fallback
        if (!user.username) {
          updates.username = nickname || user.email?.split('@')[0] || 'user';
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
    
    // Use nickname or generate username from email
    const username = nickname || email?.split('@')[0] || 'user';
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
    console.log('🔍 getUserById called with userId:', userId);
    
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });
    
    console.log('Database response:', response.data);
    
    if (response.data?.data?.length > 0) {
      console.log('✅ User found:', response.data.data[0]);
      return response.data.data[0];
    } else {
      console.log('❌ User not found in database');
      return null;
    }
  } catch (error: any) {
    console.error('❌ Error in getUserById:', error);
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    // Get all users - use created_at field to get all users
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          created_at: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });
    return response.data?.data || [];
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
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          email: { $eq: email }
        })
      }
    });
    return response.data?.data?.[0] || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

export const createUser = async (email: string, tokenAuth: string, nickname?: string): Promise<User> => {
  const userId = uuidv4();
  const profileId = uuidv4();
  const urlId = uuidv4();
  const now = new Date();

  const user: User = {
    user_id: userId,
    email,
    username: nickname || email?.split('@')[0] || 'user',
    profile_id: profileId,
    url_id_text: urlId,
    token_auth: tokenAuth,
    role: 'user', // Default role
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  try {
    await db.post('/users', user);
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    await db.delete(`/users/${userId}`);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
};

export const isAdmin = async (userId: string): Promise<boolean> => {
  try {
    console.log('🔍 isAdmin called with userId:', userId);
    
    const user = await getUserById(userId);
    console.log('User found:', user);
    
    if (!user) {
      console.log('❌ User not found in database');
      return false;
    }
    
    console.log('User role:', user.role);
    const isUserAdmin = user.role === 'admin';
    console.log('Is user admin?', isUserAdmin);
    
    return isUserAdmin;
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return false;
  }
}; 

export const getUserByProfileUrl = async (profileUrl: string): Promise<User | null> => {
  try {
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          url_id_text: { $eq: profileUrl }
        })
      }
    });
    if (response.data?.data?.length) {
      return response.data.data[0];
    }
    return null;
  } catch (error) {
    console.error('Error finding user by profileUrl:', error);
    return null;
  }
}; 