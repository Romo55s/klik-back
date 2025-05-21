import axios from 'axios';

let managementToken: string = '';
let apiToken: string | null = null;
let managementTokenExpiry: number = 0;
let apiTokenExpiry: number = 0;

function validateAuth0Config() {
  const requiredEnvVars = [
    'AUTH0_ISSUER_BASE_URL',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'AUTH0_AUDIENCE',
    'AUTH0_MANAGEMENT_AUDIENCE'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required Auth0 environment variables: ${missingVars.join(', ')}`);
  }
}

async function getToken(audience: string): Promise<string> {
  try {
    // Remove any trailing slashes and https:// from the issuer URL
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const tokenUrl = `https://${issuerBaseUrl}/oauth/token`;
    console.log('Requesting token from:', tokenUrl);
    
    const response = await axios.post(
      tokenUrl,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: audience,
        grant_type: 'client_credentials'
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.data.access_token) {
      throw new Error('No access token received from Auth0');
    }

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Auth0 token:', error);
    throw error;
  }
}

export async function getManagementToken(): Promise<string> {
  validateAuth0Config();

  // If we have a valid token, return it
  if (managementToken && Date.now() < managementTokenExpiry) {
    console.log('Using cached management token');
    return managementToken;
  }

  console.log('Getting new management token');
  try {
    // Get new token
    const response = await axios.post(
      `https://${process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '')}/oauth/token`,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: process.env.AUTH0_MANAGEMENT_AUDIENCE,
        grant_type: 'client_credentials'
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.data.access_token) {
      throw new Error('No access token received from Auth0');
    }

    const newToken = response.data.access_token;
    if (!newToken) {
      throw new Error('Invalid token received from Auth0');
    }

    managementToken = newToken;
    managementTokenExpiry = Date.now() + (23 * 60 * 60 * 1000); // 23 hours

    return managementToken;
  } catch (error) {
    console.error('Error getting management token:', error);
    throw error;
  }
}

export async function getApiToken(): Promise<string> {
  validateAuth0Config();

  // If we have a valid token, return it
  if (apiToken && Date.now() < apiTokenExpiry) {
    return apiToken;
  }

  // Get new token
  apiToken = await getToken(process.env.AUTH0_AUDIENCE!);
  apiTokenExpiry = Date.now() + (23 * 60 * 60 * 1000); // 23 hours

  return apiToken;
} 