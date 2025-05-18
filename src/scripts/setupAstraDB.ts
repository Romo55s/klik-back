import { db, schemaDb } from '../config/database';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env') });

async function createTables() {
  try {
    // Create users table
    await schemaDb.post('/tables', {
      name: 'users',
      columnDefinitions: [
        { name: 'user_id', typeDefinition: 'uuid', static: false },
        { name: 'email', typeDefinition: 'text', static: false },
        { name: 'profile_id', typeDefinition: 'uuid', static: false },
        { name: 'url_id', typeDefinition: 'uuid', static: false },
        { name: 'token_auth', typeDefinition: 'text', static: false },
        { name: 'role', typeDefinition: 'text', static: false },
        { name: 'created_at', typeDefinition: 'timestamp', static: false },
        { name: 'updated_at', typeDefinition: 'timestamp', static: false }
      ],
      primaryKey: {
        partitionKey: ['user_id']
      }
    });
    console.log('✅ Users table created');

    // Create profile table
    await schemaDb.post('/tables', {
      name: 'profile',
      columnDefinitions: [
        { name: 'profile_id', typeDefinition: 'uuid', static: false },
        { name: 'user_id', typeDefinition: 'uuid', static: false },
        { name: 'name', typeDefinition: 'text', static: false },
        { name: 'bio', typeDefinition: 'text', static: false },
        { name: 'avatar_url', typeDefinition: 'text', static: false },
        { name: 'created_at', typeDefinition: 'timestamp', static: false },
        { name: 'updated_at', typeDefinition: 'timestamp', static: false }
      ],
      primaryKey: {
        partitionKey: ['profile_id']
      }
    });
    console.log('✅ Profile table created');

    // Create card table
    await schemaDb.post('/tables', {
      name: 'card',
      columnDefinitions: [
        { name: 'card_id', typeDefinition: 'uuid', static: false },
        { name: 'user_id', typeDefinition: 'uuid', static: false },
        { name: 'name', typeDefinition: 'text', static: false },
        { name: 'description', typeDefinition: 'text', static: false },
        { name: 'created_at', typeDefinition: 'timestamp', static: false },
        { name: 'updated_at', typeDefinition: 'timestamp', static: false }
      ],
      primaryKey: {
        partitionKey: ['card_id'],
        clusteringKey: ['user_id']
      }
    });
    console.log('✅ Card table created');

    // Create scanlog table
    await schemaDb.post('/tables', {
      name: 'scanlog',
      columnDefinitions: [
        { name: 'scan_id', typeDefinition: 'uuid', static: false },
        { name: 'user_id', typeDefinition: 'uuid', static: false },
        { name: 'card_id', typeDefinition: 'uuid', static: false },
        { name: 'scan_time', typeDefinition: 'timestamp', static: false },
        { name: 'location', typeDefinition: 'text', static: false },
        { name: 'device_info', typeDefinition: 'text', static: false }
      ],
      primaryKey: {
        partitionKey: ['scan_id']
      }
    });
    console.log('✅ Scanlog table created');

    console.log('✅ All tables created successfully');
  } catch (error: any) {
    if (error.response?.status === 409) {
      console.log('Tables already exist');
    } else {
      console.error('❌ Error creating tables:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Run the setup
createTables().catch(console.error); 