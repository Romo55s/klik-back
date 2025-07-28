import dotenv from 'dotenv';
import { db } from '../config/database';

// Load environment variables
dotenv.config();

async function checkUserRole(email: string) {
  try {
    console.log(`🔍 Checking role for user with email: ${email}`);
    
    // Find the user by email
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
    console.log('✅ User found:');
    console.log('  Username:', user.username);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  User ID:', user.user_id);
    console.log('  Created:', user.created_at);
  } catch (error) {
    console.error('❌ Error checking user role:', error);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('❌ Please provide an email address');
  console.log('Usage: npm run check-role <email>');
  process.exit(1);
}

checkUserRole(email).then(() => {
  console.log('✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 