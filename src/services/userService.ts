import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { User, UserRole } from '../interfaces/user.interface';

export const findOrCreateUser = async (auth0Sub: string, email?: string): Promise<User> => {
  try {
    // Validate email
    if (!email) {
      throw new Error('Email is required to create a user');
    }

    // Find user by email
    const emailResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          email: { $eq: email }
        })
      }
    });
    
    // If user exists by email, return it
    if (emailResponse?.data?.data?.length > 0) {
      const existingUser = emailResponse.data.data[0];
      console.log('Found existing user by email:', existingUser);

      // Check if profile exists for this user
      try {
        const profileResponse = await db.get(`/profile/${existingUser.user_id}`);
        if (!profileResponse.data?.data?.length) {
          // Create profile if it doesn't exist
          const now = new Date().toISOString();
          const profile = {
            profile_id: existingUser.profile_id,
            user_id: existingUser.user_id,
            name: email.split('@')[0],
            bio: 'Welcome to my profile!',
            avatar_url: null,
            created_at: now,
            updated_at: now
          };

          await db.post('/profile', profile);
          console.log('✅ Profile created for existing user:', existingUser.user_id);
        }
      } catch (error) {
        console.error('Error checking/creating profile for existing user:', error);
        // Don't throw here, we still want to return the user
      }

      return existingUser;
    }

    // If no user found, create a new one
    console.log('No existing user found, creating new user...');
    const now = new Date().toISOString();
    const user: User = {
      user_id: uuidv4(),
      email: email,
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

      // Create profile for new user
      const profile = {
        profile_id: user.profile_id,
        user_id: user.user_id,
        name: email.split('@')[0],
        bio: 'Welcome to my profile!',
        avatar_url: null,
        created_at: now,
        updated_at: now
      };

      await db.post('/profile', profile);
      console.log('✅ Profile created for new user:', user.user_id);

      return user;
    } catch (error: any) {
      // If we get a conflict error, try to fetch the user again
      if (error.response?.status === 409) {
        console.log('User creation conflict, fetching existing user...');
        const retryResponse = await db.get('/users', {
          params: {
            where: JSON.stringify({
              email: { $eq: email }
            })
          }
        });
        
        if (retryResponse?.data?.data?.length > 0) {
          const existingUser = retryResponse.data.data[0];
          console.log('Found user after conflict:', existingUser);

          // Check if profile exists for this user
          try {
            const profileResponse = await db.get(`/profile/${existingUser.user_id}`);
            if (!profileResponse.data?.data?.length) {
              // Create profile if it doesn't exist
              const now = new Date().toISOString();
              const profile = {
                profile_id: existingUser.profile_id,
                user_id: existingUser.user_id,
                name: email.split('@')[0],
                bio: 'Welcome to my profile!',
                avatar_url: null,
                created_at: now,
                updated_at: now
              };

              await db.post('/profile', profile);
              console.log('✅ Profile created for user after conflict:', existingUser.user_id);
            }
          } catch (error) {
            console.error('Error checking/creating profile after conflict:', error);
            // Don't throw here, we still want to return the user
          }

          return existingUser;
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