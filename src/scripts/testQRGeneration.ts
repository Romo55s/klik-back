import { db } from '../config/database';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

async function testQRGeneration() {
  try {
    console.log('🧪 Testing QR code generation with new nickname-based system...\n');

    // Get a sample user from the database
    const usersResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          email: { $exists: true }
        })
      }
    });
    
    const users = usersResponse.data?.data || [];
    
    if (users.length === 0) {
      console.log('❌ No users found in database. Please create a user first.');
      return;
    }

    const testUser = users[0];
    console.log(`📋 Test user found:`);
    console.log(`   - User ID: ${testUser.user_id}`);
    console.log(`   - Email: ${testUser.email}`);
    console.log(`   - Username: ${testUser.username}`);
    console.log(`   - URL ID Text: ${testUser.url_id_text}`);
    console.log('');

    if (!testUser.url_id_text) {
      console.log('❌ User has no url_id_text. This should be generated automatically.');
      return;
    }

    // Test QR code generation
    console.log('🔍 Testing QR code generation...');
    
    // Ensure qr-codes folder exists
    const qrFolder = path.join(__dirname, '../qr-codes');
    if (!fs.existsSync(qrFolder)) {
      fs.mkdirSync(qrFolder);
      console.log('✅ Created qr-codes folder');
    }

    // Generate QR code as file
    const qrFilePath = path.join(qrFolder, `test-${testUser.user_id}.png`);
    await QRCode.toFile(qrFilePath, testUser.url_id_text, { width: 300 });
    console.log(`✅ QR code saved to: ${qrFilePath}`);

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(testUser.url_id_text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });
    console.log(`✅ QR code data URL generated (length: ${qrDataUrl.length} characters)`);

    // Test URL format
    console.log('\n🔗 Testing URL format...');
    if (testUser.url_id_text.startsWith('http')) {
      console.log('✅ URL format is correct (starts with http)');
    } else {
      console.log('⚠️  URL format might be incorrect (does not start with http)');
    }

    // Test if URL contains username
    if (testUser.url_id_text.includes(testUser.username)) {
      console.log('✅ URL contains the username');
    } else {
      console.log('⚠️  URL does not contain the username');
    }

    console.log('\n🎉 QR code generation test completed successfully!');
    console.log(`📁 Check the generated QR code at: ${qrFilePath}`);

  } catch (error) {
    console.error('❌ Error during QR code generation test:', error);
  }
}

testQRGeneration().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 