import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { db } from '../config/database';
import { Card, CreateCardDto, UpdateCardDto } from '../interfaces/card.interface';

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

export const createCard = async (userId: string, profileUrl: string, cardData: CreateCardDto): Promise<Card> => {
  try {
    console.log('🔍 createCard service called with:', { userId, profileUrl, cardData });
    
    // Get user information to get username for default card name
    let username = 'User';
    try {
      const userResponse = await db.get(`/users/${userId}`);
      if (userResponse.data?.data?.[0]?.username) {
        username = userResponse.data.data[0].username;
      }
    } catch (error) {
      console.warn('Could not fetch user info for card name, using default');
    }
    
    const cardId = uuidv4();
    const now = new Date().toISOString();

    const card: Card = {
      user_id: userId,
      card_id: cardId,
      name: cardData.name || `Card ${username}`,
      description: cardData.description || 'Professional digital card',
      status: 'inactive',
      is_verified: false,
      created_at: now,
      updated_at: now
    };

    console.log('🔍 About to create card in DB:', card);
    await db.post('/card', card);
    console.log('✅ Card created successfully in DB');

    return card;
  } catch (error) {
    console.error('Error creating card:', error);
    throw new Error('Failed to create card');
  }
};

export const activateCard = async (userId: string, cardId: string): Promise<Card> => {
  try {
    console.log('🔍 activateCard called with:', { userId, cardId });
    
    // Get the card
    console.log('🔍 Getting card from DB...');
    const cardResponse = await db.get(`/card/${userId}/${cardId}`);
    console.log('🔍 Card response:', cardResponse.data);
    
    if (!cardResponse.data?.data?.length) {
      console.log('🔍 Card not found in DB');
      throw new Error('Card not found');
    }

    const card = cardResponse.data.data[0];
    console.log('🔍 Found card:', card);
    
    // Update card status - only include fields that can be updated
    const updates = {
      status: 'active',
      is_verified: true,
      updated_at: new Date().toISOString()
    };
    
    console.log('🔍 About to update card with:', updates);
    const updatedCard = await db.put(`/card/${userId}/${cardId}`, updates);
    console.log('✅ Card activated successfully:', updatedCard.data);
    return updatedCard.data;
  } catch (error: any) {
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

export const verifyCardForUser = async (userId: string): Promise<boolean> => {
  try {
    // Get all cards for the user
    const cards = await getCardByUserId(userId);
    if (!cards.length) {
      console.warn('No card found for user:', userId);
      return false;
    }
    // For simplicity, verify the first card
    const card = cards[0];
    if (card.is_verified) {
      console.log('Card already verified for user:', userId);
      return false;
    }
    const updates = {
      is_verified: true,
      status: 'active',
      updated_at: new Date().toISOString()
    };
    await db.put(`/card/${userId}/${card.card_id}`, updates);
    console.log('✅ Card verified for user:', userId);
    return true;
  } catch (error) {
    console.error('Error verifying card for user:', error);
    return false;
  }
};

// Helper function to check if a card is valid (verified and active)
export const isCardValid = (card: Card): boolean => {
  return card.is_verified && card.status === 'active';
};

// Helper function to get valid card for user
export const getValidCardForUser = async (userId: string): Promise<Card | null> => {
  try {
    console.log('🔍 getValidCardForUser called for userId:', userId);
    
    const cards = await getCardByUserId(userId);
    console.log('🔍 All cards for user:', cards);
    
    if (!cards.length) {
      console.log('🔍 No cards found for user');
      return null;
    }
    
    const card = cards[0];
    console.log('🔍 First card:', card);
    console.log('🔍 Card is_verified:', card.is_verified);
    console.log('🔍 Card status:', card.status);
    
    if (isCardValid(card)) {
      console.log('🔍 Card is valid, returning it');
      return card;
    }
    
    console.log('🔍 Card is not valid, returning null');
    return null;
  } catch (error) {
    console.error('Error getting valid card for user:', error);
    return null;
  }
}; 