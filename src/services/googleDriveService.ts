import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

// Google Drive API configuration
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const FOLDER_NAME = 'KlikApp';
const QR_FOLDER_NAME = 'QR_Codes';
const BACKGROUND_FOLDER_NAME = 'Background_Images';

class GoogleDriveService {
  private drive: any;
  private folderId: string | null = null;
  private qrFolderId: string | null = null;
  private backgroundFolderId: string | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Don't initialize immediately - wait for first use
  }

  private async initializeDrive() {
    if (this.isInitialized) return;
    
    try {
      // Check if refresh token is available
      if (!process.env.GOOGLE_REFRESH_TOKEN) {
        console.log('⚠️ Google Drive not initialized - no refresh token available');
        return;
      }

      // Initialize OAuth2 client
      const auth = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3000/auth/google/callback' // Use the same redirect URI
      );

      // Set credentials with refresh token
      auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

      // Create Drive service client
      this.drive = google.drive({ 
        version: 'v3', 
        auth 
      });
      
      // Test the connection
      try {
        await this.drive.about.get({ fields: 'user' });
        console.log('✅ Google Drive connection successful');
      } catch (error) {
        console.error('❌ Google Drive connection failed:', error instanceof Error ? error.message : 'Unknown error');
        return;
      }
      
      // Create or get main folder
      await this.ensureFolders();
      
      this.isInitialized = true;
      console.log('✅ Google Drive service initialized');
    } catch (error) {
      console.error('❌ Error initializing Google Drive:', error);
    }
  }

  private async ensureFolders() {
    try {
      // Create or get main folder
      this.folderId = await this.findOrCreateFolder(FOLDER_NAME);
      
      // Create or get QR codes folder
      this.qrFolderId = await this.findOrCreateFolder(QR_FOLDER_NAME, this.folderId);
      
      // Create or get background images folder
      this.backgroundFolderId = await this.findOrCreateFolder(BACKGROUND_FOLDER_NAME, this.folderId);
      
      console.log('✅ Folders ensured:', {
        main: this.folderId,
        qr: this.qrFolderId,
        background: this.backgroundFolderId
      });
    } catch (error) {
      console.error('❌ Error ensuring folders:', error);
    }
  }

  private async findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    try {
      // Search for existing folder
      const query = parentId 
        ? `name='${folderName}' and '${parentId}' in parents and trashed=false`
        : `name='${folderName}' and 'root' in parents and trashed=false`;
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)'
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId && { parents: [parentId] })
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      return folder.data.id;
    } catch (error) {
      console.error(`❌ Error finding/creating folder ${folderName}:`, error);
      throw error;
    }
  }

  async uploadQRCode(userId: string, qrCodePath: string): Promise<string> {
    await this.initializeDrive();
    
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized. Please set GOOGLE_REFRESH_TOKEN in your .env file');
    }
    
    try {
      const fileName = `qr_${userId}.png`;
      
      // Upload file to Google Drive
      const fileMetadata = {
        name: fileName,
        parents: [this.qrFolderId!]
      };

      const media = {
        mimeType: 'image/png',
        body: fs.createReadStream(qrCodePath)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get thumbnail link for frontend display
      const downloadLink = `https://drive.google.com/thumbnail?id=${file.data.id}`;
      
      console.log('✅ QR code uploaded to Google Drive:', downloadLink);
      return downloadLink;
    } catch (error) {
      console.error('❌ Error uploading QR code:', error);
      throw error;
    }
  }

  async uploadBackgroundImage(userId: string, imagePath: string): Promise<string> {
    await this.initializeDrive();
    
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized. Please set GOOGLE_REFRESH_TOKEN in your .env file');
    }
    
    try {
      const fileName = `background_${userId}.jpg`;
      
      // Upload file to Google Drive
      const fileMetadata = {
        name: fileName,
        parents: [this.backgroundFolderId!]
      };

      const media = {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(imagePath)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get thumbnail link for frontend display
      const downloadLink = `https://drive.google.com/thumbnail?id=${file.data.id}`;
      
      console.log('✅ Background image uploaded to Google Drive:', downloadLink);
      return downloadLink;
    } catch (error) {
      console.error('❌ Error uploading background image:', error);
      throw error;
    }
  }



  async uploadGeneralImage(userId: string, imagePath: string): Promise<string> {
    await this.initializeDrive();
    
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized. Please set GOOGLE_REFRESH_TOKEN in your .env file');
    }
    
    try {
      const fileName = `general_${userId}_${Date.now()}.jpg`;
      
      // Upload file to Google Drive
      const fileMetadata = {
        name: fileName,
        parents: [this.folderId!]
      };

      const media = {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(imagePath)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get thumbnail link for frontend display
      const downloadLink = `https://drive.google.com/thumbnail?id=${file.data.id}`;
      
      console.log('✅ General image uploaded to Google Drive:', downloadLink);
      return downloadLink;
    } catch (error) {
      console.error('❌ Error uploading general image:', error);
      throw error;
    }
  }



  async deleteFile(fileId: string): Promise<void> {
    await this.initializeDrive();
    
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized. Please set GOOGLE_REFRESH_TOKEN in your .env file');
    }
    
    try {
      await this.drive.files.delete({
        fileId: fileId
      });
      console.log('✅ File deleted from Google Drive:', fileId);
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      throw error;
    }
  }

  async getFileInfo(fileId: string): Promise<any> {
    await this.initializeDrive();
    
    if (!this.isInitialized) {
      throw new Error('Google Drive not initialized. Please set GOOGLE_REFRESH_TOKEN in your .env file');
    }
    
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, size, createdTime, webViewLink'
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error getting file info:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const googleDriveService = new GoogleDriveService(); 