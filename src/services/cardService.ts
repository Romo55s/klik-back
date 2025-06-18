import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { db } from '../config/database';
import { Card, CreateCardDto, UpdateCardDto } from '../interfaces/card.interface';
import { generateProfileUrl } from './userService';

export const generateQRCode = async (url: string): Promise<string> => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

export const createCard = async (userId: string, urlId: string, cardData: CreateCardDto): Promise<Card> => {
  try {
    const cardId = uuidv4();
    const now = new Date().toISOString();
    
    // Generate profile URL
    const profileUrl = generateProfileUrl(urlId);

    const card: Card = {
      user_id: userId,
      card_id: cardId,
      name: cardData.name || `${userId}'s Card`,
      description: cardData.description || 'Profile access card',
      status: 'inactive',
      is_verified: false,
      created_at: now,
      updated_at: now
    };

    await db.post('/card', card);
    console.log('✅ Card created');

    return card;
  } catch (error) {
    console.error('Error creating card:', error);
    throw new Error('Failed to create card');
  }
};

export const activateCard = async (userId: string, cardId: string): Promise<Card> => {
  try {
    // Get the card
    const cardResponse = await db.get(`/card/${userId}/${cardId}`);
    if (!cardResponse.data?.data?.length) {
      throw new Error('Card not found');
    }

    const card = cardResponse.data.data[0];
    
    // Update card status
    const updates: Card = {
      ...card,
      status: 'active',
      is_verified: true,
      updated_at: new Date().toISOString()
    };

    const updatedCard = await db.put(`/card/${userId}/${cardId}`, updates);

    console.log('✅ Card activated');
    return updatedCard.data;
  } catch (error) {
    console.error('Error activating card:', error);
    throw new Error('Failed to activate card');
  }
};

export const getCardByUserId = async (userId: string): Promise<Card[]> => {
  try {
    const response = await db.get('/card', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching cards:', error);
    throw new Error('Failed to fetch cards');
  }
};

export const getCardById = async (userId: string, cardId: string): Promise<Card> => {
  try {
    const response = await db.get(`/card/${userId}/${cardId}`);
    if (!response.data?.data?.length) {
      throw new Error('Card not found');
    }
    return response.data.data[0];
  } catch (error) {
    console.error('Error fetching card:', error);
    throw new Error('Failed to fetch card');
  }
}; 