import { db } from '../config/database';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

async function generateQRCodesForAllUsers() {
  try {
    // Get all users from the database
    const usersResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          email: { $eq: 'test@gmail.com' }
        })
      }
    });
    
    const users = usersResponse.data?.data || [];
    console.log(`Found ${users.length} users to process`);

    if (users.length === 0) {
      console.log("No users found in the database");
      return;
    }

    // Ensure qr-codes folder exists
    const qrFolder = path.join(__dirname, '../qr-codes');
    if (!fs.existsSync(qrFolder)) {
      fs.mkdirSync(qrFolder);
      console.log('✅ Created qr-codes folder');
    }

    let successCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      try {
        if (user.url_id_text) {
          const qrFilePath = path.join(qrFolder, `${user.user_id}.png`);
          await QRCode.toFile(qrFilePath, user.url_id_text, { width: 300 });
          console.log(`✅ QR code generated for user: ${user.username || user.email} (${user.user_id})`);
          successCount++;
        } else {
          console.warn(`⚠️  No url_id_text for user: ${user.username || user.email} (${user.user_id})`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error generating QR code for user ${user.user_id}:`, error);
        skippedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully generated: ${successCount} QR codes`);
    console.log(`⚠️  Skipped: ${skippedCount} users (no url_id_text)`);
    console.log(`📁 QR codes saved in: ${qrFolder}`);

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    process.exit(1);
  }
}

// Allow running for a specific user by email (backward compatibility)
async function generateQRCodeForSpecificUser(email: string) {
  try {
    const usersResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          email: { $eq: email }
        })
      }
    });
    
    const users = usersResponse.data?.data || [];
    if (users.length === 0) {
      console.log(`No user found with email: ${email}`);
      return;
    }
    
    const user = users[0];
    const qrFolder = path.join(__dirname, '../qr-codes');
    if (!fs.existsSync(qrFolder)) fs.mkdirSync(qrFolder);

    if (user.url_id_text) {
      const qrFilePath = path.join(qrFolder, `${user.user_id}.png`);
      await QRCode.toFile(qrFilePath, user.url_id_text, { width: 300 });
      console.log(`✅ QR code generated for user: ${user.username || user.email} (${user.user_id})`);
      console.log(`📁 QR code saved at: ${qrFilePath}`);
    } else {
      console.warn(`⚠️  No url_id_text for user: ${user.username || user.email} (${user.user_id})`);
    }
  } catch (error) {
    console.error('❌ Error generating QR code for specific user:', error);
  }
}

// Check if email is provided as command line argument
const emailArg = process.argv[2];
if (emailArg) {
  console.log(`Generating QR code for specific user: ${emailArg}`);
  generateQRCodeForSpecificUser(emailArg).then(() => {
    console.log('Done!');
    process.exit(0);
  });
} else {
  console.log('Generating QR codes for all users...');
  generateQRCodesForAllUsers().then(() => {
    console.log('Done!');
    process.exit(0);
  });
} 