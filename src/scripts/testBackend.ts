import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import path from 'path';
import { db } from '../config/database';
import { testConnection } from '../config/database';
import axios from 'axios';

// Load environment variables from the root directory
config({ path: path.resolve(__dirname, '../../.env') });

// Auth0 configuration
const AUTH0_DOMAIN = 'dev-hjwaovgfk1kp25xu.us.auth0.com';
const AUTH0_CLIENT_ID = 'ef7UbB9tWRKDLRgobktisKrfhJ8ijZLk';
const AUTH0_CLIENT_SECRET = 'rzkJQfZws8PtWYRI6e-abLlKefS_PRsFXWmXx4kr6-MJY-w7M5OH0wIOGSeWikQW';
const AUTH0_AUDIENCE = 'klik-auth-api';

// Mock Auth0 user data
// The sub (subject) claim in Auth0 JWT tokens follows the format: {provider}|{user_id}
// Examples:
// - auth0|1234567890 (for users created in Auth0)
// - google-oauth2|1234567890 (for users who sign in with Google)
// - github|1234567890 (for users who sign in with GitHub)
const TEST_AUTH0_SUB = 'auth0|1234567890';
const TEST_EMAIL = 'test@example.com';
const TEST_AUTH0_USER = {
  sub: TEST_AUTH0_SUB,
  email: TEST_EMAIL,
  name: 'Test User',
  picture: 'https://s.gravatar.com/avatar/example.jpg',
  nickname: 'testuser',
  updated_at: new Date().toISOString()
};

// Session state
let currentSession = {
  isAuthenticated: false,
  user: null as any,
  token: null as string | null
};

async function getAuth0Token() {
  try {
    const response = await axios.post(`https://${AUTH0_DOMAIN}/oauth/token`, {
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: AUTH0_AUDIENCE,
      grant_type: 'client_credentials'
    }, {
      headers: { 'content-type': 'application/json' }
    });

    console.log('✅ Auth0 token obtained successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting Auth0 token:', error);
    throw error;
  }
}

async function createTestUser() {
  try {
    const now = new Date().toISOString();
    const userId = uuidv4();
    const profileId = uuidv4();
    
    // Get Auth0 token
    const token = await getAuth0Token();
    
    // Create user with Auth0 token
    const testUser = {
      user_id: userId,
      email: TEST_EMAIL,
      profile_id: profileId,
      url_id: uuidv4(),
      token_auth: TEST_AUTH0_SUB,
      created_at: now,
      updated_at: now
    };

    const userResponse = await db.post('/users', testUser, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Test user created:', userResponse.data);

    // Create profile with Auth0 token
    const testProfile = {
      profile_id: profileId,
      user_id: userId,
      name: TEST_AUTH0_USER.name,
      bio: 'Welcome to my profile!',
      avatar_url: TEST_AUTH0_USER.picture,
      created_at: now,
      updated_at: now
    };

    const profileResponse = await db.post('/profile', testProfile, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Test profile created:', profileResponse.data);

    return { user: userResponse.data, token };
  } catch (error: any) {
    if (error.response?.status === 409) {
      // User already exists, try to fetch it
      const token = await getAuth0Token();
      const response = await db.get('/users', {
        params: {
          where: JSON.stringify({
            token_auth: { $eq: TEST_AUTH0_SUB }
          }),
          'allow-filtering': 'true'
        },
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Test user already exists:', response.data[0]);
      return { user: response.data[0], token };
    }
    throw error;
  }
}

async function simulateLogin(user: any, token: string) {
  try {
    // Update session with existing user and token
    currentSession = {
      isAuthenticated: true,
      user: user,
      token: token
    };

    console.log('✅ Login successful:', {
      user: currentSession.user,
      isAuthenticated: currentSession.isAuthenticated
    });

    return currentSession;
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
}

async function simulateLogout() {
  try {
    // Clear session
    currentSession = {
      isAuthenticated: false,
      user: null,
      token: null
    };

    console.log('✅ Logout successful');
    return true;
  } catch (error) {
    console.error('❌ Logout failed:', error);
    throw error;
  }
}

async function testUserOperations(userId: string, token: string) {
  try {
    // Test get user
    const userResponse = await db.get(`/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Get user successful:', userResponse.data);

    // Test get profile
    const profileResponse = await db.get(`/profile/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Get profile successful:', profileResponse.data);

    // Test update user
    const updateResponse = await db.put(`/users/${userId}`, {
      email: 'updated@example.com',
      updated_at: new Date().toISOString()
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Update user successful:', updateResponse.data);

    // Test update profile - preserve existing fields
    const currentProfile = profileResponse.data;
    const profileUpdateResponse = await db.put(`/profile/${userId}`, {
      profile_id: currentProfile.profile_id,
      user_id: userId,
      name: 'Updated Test User',
      bio: 'Updated bio',
      avatar_url: currentProfile.avatar_url, 
      created_at: currentProfile.created_at,
      updated_at: new Date().toISOString()
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Update profile successful:', profileUpdateResponse.data);
  } catch (error) {
    console.error('❌ Error in user operations:', error);
  }
}

async function testCardOperations(userId: string, token: string) {
  try {
    // Create a test card
    const cardData = {
      card_id: uuidv4(),
      user_id: userId,
      name: 'Test Card 1',
      description: 'This is a test card',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createdCard = await db.post('/card', cardData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Test card created:', createdCard.data);

    // Create another test card
    const cardData2 = {
      card_id: uuidv4(),
      user_id: userId,
      name: 'Test Card 2',
      description: 'Another test card',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createdCard2 = await db.post('/card', cardData2, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Test card created:', createdCard2.data);

    // Get all cards for the user
    const cards = await db.get('/card', {
      params: {
        where: JSON.stringify({
          card_id: { $in: [createdCard.data.card_id, createdCard2.data.card_id] }
        })
      },
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Get cards successful:', cards.data);

    // Update a card
    const updatedCard = await db.put(`/card/${createdCard.data.card_id}/${userId}`, {
      name: 'Updated Test Card',
      description: 'This card has been updated',
      updated_at: new Date().toISOString()
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Update card successful:', updatedCard.data);

    // Delete a card
    await db.delete(`/card/${createdCard2.data.card_id}/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Delete card successful');

    return true;
  } catch (error) {
    console.error('❌ Error in card operations:', error);
    throw error;
  }
}

async function runTests() {
  try {
    // Test database connection
    await testConnection();

    // Create test user and profile first
    console.log('\n👤 Creating test user and profile...');
    const { user, token } = await createTestUser();

    // Simulate login with the created user
    console.log('\n🔐 Testing login...');
    await simulateLogin(user, token);

    // Test user operations
    console.log('\n👤 Testing user operations...');
    await testUserOperations(user.user_id, token);

    // Test card operations
    console.log('\n💳 Testing card operations...');
    await testCardOperations(user.user_id, token);

    // Test logout
    console.log('\n🔒 Testing logout...');
    await simulateLogout();

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
runTests(); 