import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { CreateCardDto, Card } from '../interfaces/card.interface';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { createCard as createCardService, activateCard, getCardByUserId, getCardById } from '../services/cardService';
import { generateProfileUrl } from '../services/userService';

export const createCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const cardData: CreateCardDto = req.body;

    // Get user data to get url_id_text
    const userResponse = await db.get(`/users/${userId}`);
    if (!userResponse.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResponse.data;
    if (!user.url_id_text_text) {
      return res.status(400).json({ error: 'User has no URL ID' });
    }

    const card = await createCardService(userId, user.url_id_text, cardData);
    console.log('✅ Card created');

    // Generate QR code for response
    const profileUrl = generateProfileUrl(user.url_id_text_text);
    const qrCodeDataUrl = await QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    res.status(201).json({
      ...card,
      qr_code_image: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Error creating card' });
  }
};

export const getUserCards = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user data for url_id_text
    const userResponse = await db.get(`/users/${userId}`);
    if (!userResponse.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResponse.data;
    if (!user.url_id_text) {
      return res.status(400).json({ error: 'User has no URL ID' });
    }

    const cards = await getCardByUserId(userId);
    const profileUrl = generateProfileUrl(user.url_id_text);
    
    // Generate QR code once for all cards
    const qrCodeDataUrl = await QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    const cardsWithQR = cards.map((card: Card) => ({
      ...card,
      qr_code_image: qrCodeDataUrl
    }));

    res.json(cardsWithQR);
  } catch (error) {
    console.error('Error fetching user cards:', error);
    res.status(500).json({ error: 'Error fetching user cards' });
  }
};

export const getUserCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { cardId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user data for url_id_text
    const userResponse = await db.get(`/users/${userId}`);
    if (!userResponse.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResponse.data;
    if (!user.url_id_text) {
      return res.status(400).json({ error: 'User has no URL ID' });
    }

    const card = await getCardById(userId, cardId);
    const profileUrl = generateProfileUrl(user.url_id_text);
    
    // Generate QR code for response
    const qrCodeDataUrl = await QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    res.json({
      ...card,
      qr_code_image: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ error: 'Error fetching card' });
  }
};

export const deactivateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { cardId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const cardResponse = await db.get(`/card/${userId}/${cardId}`);
    if (!cardResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResponse.data.data[0];
    const updates: Card = {
      ...card,
      status: 'inactive',
      is_verified: false,
      updated_at: new Date().toISOString()
    };

    await db.put(`/card/${userId}/${cardId}`, updates);
    console.log('✅ Card deactivated');

    res.json(updates);
  } catch (error) {
    console.error('Error deactivating card:', error);
    res.status(500).json({ error: 'Error deactivating card' });
  }
};

export const activateUserCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { cardId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const card = await activateCard(userId, cardId);
    console.log('✅ Card activated');

    res.json(card);
  } catch (error) {
    console.error('Error activating card:', error);
    res.status(500).json({ error: 'Error activating card' });
  }
}; 