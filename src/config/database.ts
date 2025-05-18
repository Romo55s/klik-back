import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';

// Load environment variables first
config();

const ASTRA_DB_ID = process.env.ASTRA_DB_ID;
const ASTRA_DB_REGION = process.env.ASTRA_DB_REGION;
const ASTRA_DB_KEYSPACE = process.env.ASTRA_DB_KEYSPACE;
const ASTRA_DB_APPLICATION_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;

if (!ASTRA_DB_ID || !ASTRA_DB_REGION || !ASTRA_DB_KEYSPACE || !ASTRA_DB_APPLICATION_TOKEN) {
  console.error('Missing environment variables:');
  console.error('ASTRA_DB_ID:', ASTRA_DB_ID ? '✓' : '✗');
  console.error('ASTRA_DB_REGION:', ASTRA_DB_REGION ? '✓' : '✗');
  console.error('ASTRA_DB_KEYSPACE:', ASTRA_DB_KEYSPACE ? '✓' : '✗');
  console.error('ASTRA_DB_APPLICATION_TOKEN:', ASTRA_DB_APPLICATION_TOKEN ? '✓' : '✗');
  throw new Error('Missing required AstraDB configuration');
}

// Base URL for the REST API
export const baseUrl = `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v2/keyspaces/${ASTRA_DB_KEYSPACE}`;

// Headers for REST API requests
export const headers = {
  'x-cassandra-token': ASTRA_DB_APPLICATION_TOKEN,
  'content-type': 'application/json',
  'accept': 'application/json'
};

// Create an axios instance with default config for data operations
export const db = axios.create({
  baseURL: baseUrl,
  headers
});

// Create an axios instance for schema operations
export const schemaDb = axios.create({
  baseURL: `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v2/schemas/keyspaces/${ASTRA_DB_KEYSPACE}`,
  headers
});

// Test the connection
export async function testConnection() {
  try {
    // Try to get the users table with a where clause using a UUID
    const response = await db.get('/users', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: uuidv4() }
        })
      }
    });
    console.log('✅ Connected to AstraDB successfully');
    return true;
  } catch (error: any) {
    if (error.response) {
      // If we get a 404, it means the table exists but is empty (which is fine)
      if (error.response.status === 404) {
        console.log('✅ Connected to AstraDB successfully (table exists but is empty)');
        return true;
      }
      console.error('❌ Error response from AstraDB:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('❌ Error connecting to AstraDB:', error.message);
    }
    throw error;
  }
} 