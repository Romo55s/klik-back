import { Response } from 'express';
import Card from '../models/Card';
import { ICard } from '../interfaces/card.interface';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

export const createCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cardId, name, description } = req.body;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const card = new Card({
      cardId,
      userId,
      name,
      description,
    });

    await card.save();
    res.status(201).json(card);
  } catch (error) {
    res.status(500).json({ error: 'Error creating card' });
  }
};

export const getCards = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const cards = await Card.find({ userId });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching cards' });
  }
};

export const getCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const card = await Card.findOne({ _id: id, userId });
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching card' });
  }
};

export const updateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;
    const { name, description } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const card = await Card.findOneAndUpdate(
      { _id: id, userId },
      { name, description },
      { new: true }
    );

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json(card);
  } catch (error) {
    res.status(500).json({ error: 'Error updating card' });
  }
};

export const deleteCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const card = await Card.findOneAndDelete({ _id: id, userId });
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting card' });
  }
};

export const associateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { qr_code } = req.body;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!qr_code) {
      return res.status(400).json({ error: 'QR code is required' });
    }

    // Find the card by QR code
    const cardResponse = await db.get('/card', {
      params: {
        where: JSON.stringify({
          qr_code: { $eq: qr_code }
        })
      }
    });

    if (!cardResponse.data?.data?.length) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResponse.data.data[0];

    // Check if card is already associated with a user
    if (card.user_id) {
      return res.status(400).json({ error: 'Card is already associated with a user' });
    }

    // Associate card with user
    const now = new Date().toISOString();
    const updatedCard = {
      ...card,
      user_id: userId,
      status: 'active',
      is_verified: true,
      updated_at: now
    };

    await db.put(`/card/${card.card_id}`, updatedCard);
    console.log('✅ Card associated with user');

    res.json({
      message: 'Card successfully associated with your account',
      card: updatedCard
    });
  } catch (error) {
    console.error('Error associating card:', error);
    res.status(500).json({ error: 'Error associating card' });
  }
};

export const getUserCards = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const cardsResponse = await db.get('/card', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        })
      }
    });

    res.json(cardsResponse.data);
  } catch (error) {
    console.error('Error fetching user cards:', error);
    res.status(500).json({ error: 'Error fetching user cards' });
  }
};

export const deactivateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { card_id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the card
    const cardResponse = await db.get(`/card/${card_id}`);
    if (!cardResponse.data) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResponse.data;

    // Verify the card belongs to the user
    if (card.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to modify this card' });
    }

    // Update card status
    const now = new Date().toISOString();
    const updatedCard = {
      ...card,
      status: 'inactive',
      updated_at: now
    };

    await db.put(`/card/${card_id}`, updatedCard);
    console.log('✅ Card deactivated');

    res.json({
      message: 'Card successfully deactivated',
      card: updatedCard
    });
  } catch (error) {
    console.error('Error deactivating card:', error);
    res.status(500).json({ error: 'Error deactivating card' });
  }
};

export const generateCardQR = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const cardId = uuidv4();
    const qrCode = `klik-card-${cardId}`; // Unique identifier for the card

    const now = new Date().toISOString();
    const card = {
      card_id: cardId,
      qr_code: qrCode,
      name: name || 'New Card',
      description: description || '',
      status: 'inactive',
      is_verified: false,
      created_at: now,
      updated_at: now
    };

    // Save card to database
    await db.post('/card', card);

    // Generate QR code image
    const qrCodeDataUrl = await QRCode.toDataURL(qrCode);

    res.json({
      message: 'Card QR code generated successfully',
      card,
      qr_code_image: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Error generating card QR:', error);
    res.status(500).json({ error: 'Error generating card QR' });
  }
}; 