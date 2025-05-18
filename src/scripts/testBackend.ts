import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import path from 'path';
import { db } from '../config/database';
import { testConnection } from '../config/database';

// Load environment variables from the root directory
config({ path: path.resolve(__dirname, '../../.env') });

// Mock Auth0 sub for testing
const TEST_AUTH0_SUB = 'auth0|test-user-123';
const TEST_EMAIL = 'test@example.com';

async function createTestUser() {
  try {
    const now = new Date().toISOString();
    const testUser = {
      user_id: uuidv4(),
      email: TEST_EMAIL,
      profile_id: uuidv4(),
      url_id: uuidv4(),
      token_auth: TEST_AUTH0_SUB,
      created_at: now,
      updated_at: now
    };

    const response = await db.post('/users', testUser);
    console.log('✅ Test user created:', response.data);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 409) {
      // User already exists, try to fetch it
      const response = await db.get('/users', {
        params: {
          where: JSON.stringify({
            token_auth: { $eq: TEST_AUTH0_SUB }
          })
        }
      });
      console.log('✅ Test user already exists:', response.data[0]);
      return response.data[0];
    }
    throw error;
  }
}

async function createTestCards(userId: string) {
  const cards = [
    {
      card_id: uuidv4(),
      user_id: userId,
      name: 'Test Card 1',
      description: 'This is a test card',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      card_id: uuidv4(),
      user_id: userId,
      name: 'Test Card 2',
      description: 'Another test card',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  for (const card of cards) {
    try {
      const response = await db.post('/card', card);
      console.log('✅ Test card created:', response.data);
    } catch (error) {
      console.error('❌ Error creating test card:', error);
    }
  }
}

async function testUserOperations(userId: string) {
  try {
    // Test get user
    const userResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });
    console.log('✅ Get user successful:', userResponse.data[0]);

    // Test update user
    const updateResponse = await db.put(`/users/${userId}`, {
      email: 'updated@example.com',
      updated_at: new Date().toISOString()
    });
    console.log('✅ Update user successful:', updateResponse.data);
  } catch (error) {
    console.error('❌ Error in user operations:', error);
  }
}

async function testCardOperations(userId: string) {
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

    const createdCard = await db.post('/card', cardData);
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

    const createdCard2 = await db.post('/card', cardData2);
    console.log('✅ Test card created:', createdCard2.data);

    // Get all cards for the user
    const cards = await db.get('/card', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        }),
        'allow-filtering': 'true'
      }
    });
    console.log('✅ Get cards successful:', cards.data);

    // Update a card
    const updatedCard = await db.put(`/card/${createdCard.data.card_id}`, {
      name: 'Updated Test Card',
      description: 'This card has been updated',
      updated_at: new Date().toISOString()
    });
    console.log('✅ Update card successful:', updatedCard.data);

    // Delete a card
    await db.delete(`/card/${createdCard2.data.card_id}`);
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

    // Create test user
    const user = await createTestUser();

    // Create test cards
    await createTestCards(user.user_id);

    // Test user operations
    await testUserOperations(user.user_id);

    // Test card operations
    await testCardOperations(user.user_id);

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
runTests(); 