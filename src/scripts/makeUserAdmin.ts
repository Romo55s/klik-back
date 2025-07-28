import dotenv from 'dotenv';
import { db } from '../config/database';

// Load environment variables
dotenv.config();

async function makeUserAdmin(email: string) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // First, find the user by email
    const userResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          email: { $eq: email }
        })
      }
    });

    if (!userResponse.data?.data?.length) {
      console.log('❌ User not found');
      return;
    }

    const user = userResponse.data.data[0];
    console.log('✅ User found:', user.username);

    // Update the user's role to admin
    const updateResponse = await db.put(`/users/${user.user_id}`, {
      role: 'admin',
      updated_at: new Date().toISOString()
    });

    console.log('✅ User role updated to admin successfully');
    console.log('Updated user:', updateResponse.data);
  } catch (error) {
    console.error('❌ Error making user admin:', error);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('❌ Please provide an email address');
  console.log('Usage: npm run make-admin <email>');
  process.exit(1);
}

makeUserAdmin(email).then(() => {
  console.log('✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 