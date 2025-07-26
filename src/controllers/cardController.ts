import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { CreateCardDto, Card } from '../interfaces/card.interface';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { createCard as createCardService, activateCard, getCardByUserId, getCardById, getValidCardForUser } from '../services/cardService';
import { getUserByProfileUrl } from '../services/userService';

export const createCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user already has a valid card
    const existingValidCard = await getValidCardForUser(userId);
    
    if (existingValidCard) {
      return res.status(400).json({ 
        error: 'User already has a valid card. Only one card per user is allowed.',
        existingCard: existingValidCard
      });
    }

    const cardData: CreateCardDto = req.body;

    // Get user data to get url_id_text
    const userResponse = await db.get(`/users/${userId}`);
    if (!userResponse.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResponse.data.data[0]; // Fix: access the first user from the data array
    if (!user.url_id_text) {
      return res.status(400).json({ error: 'User has no URL ID' });
    }

    const card = await createCardService(userId, user.url_id_text, cardData);

    // Automatically activate and verify the card since it's being created by the user
    const activatedCard = await activateCard(userId, card.card_id);

    // Generate QR code for response
    const profileUrl = user.url_id_text;
    const qrCodeDataUrl = await QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    res.status(201).json({
      ...activatedCard,
      qr_code_image: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Error creating card' });
  }
};

export const getUserCard = async (req: AuthenticatedRequest, res: Response) => {
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

    const user = userResponse.data.data[0]; // Fix: access the first user from the data array
    
    // Get valid card for this user
    try {
      const card = await getValidCardForUser(userId);
      
      if (!card) {
        return res.status(404).json({ 
          error: 'No valid card found for this user',
          message: 'Create a card first or activate your existing card'
        });
      }
      
      // Generate QR code if user has url_id_text, otherwise return card without QR
      if (user.url_id_text) {
        const qrCodeDataUrl = await QRCode.toDataURL(user.url_id_text, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 300
        });
        return res.status(200).json({ ...card, qr_code_image: qrCodeDataUrl });
      }
      return res.status(200).json(card);
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching card' });
    }
  } catch (error) {
    console.error('Error fetching user card:', error);
    res.status(500).json({ error: 'Error fetching user card' });
  }
};

export const deactivateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { cardId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const card = await getCardById(userId, cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Check if user owns this card
    if (card.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to modify this card' });
    }

    const updatedCard = await db.put(`/card/${userId}/${cardId}`, {
      status: 'inactive',
      updated_at: new Date().toISOString()
    });

    console.log('✅ Card deactivated');

    res.json(updatedCard.data);
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

    const card = await getCardById(userId, cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Check if user owns this card
    if (card.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to modify this card' });
    }

    const activatedCard = await activateCard(userId, cardId);
    console.log('✅ Card activated');

    res.json(activatedCard);
  } catch (error) {
    console.error('Error activating card:', error);
    res.status(500).json({ error: 'Error activating card' });
  }
};

export const claimCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { profileUrl, profileUserId } = req.body; // Accept both for backward compatibility

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user already has a valid card
    const existingValidCard = await getValidCardForUser(userId);
    if (existingValidCard) {
      return res.status(400).json({ 
        error: 'User already has a valid card. Only one card per user is allowed.',
        existingCard: existingValidCard
      });
    }

    // Check if we have either profileUrl or profileUserId
    if (!profileUrl && !profileUserId) {
      return res.status(400).json({ 
        error: 'Either profileUrl or profileUserId is required',
        received: req.body
      });
    }

    // Get the profile user's information
    let profileUser;
    
    if (profileUrl) {
      // Use profile URL to find user
      profileUser = await getUserByProfileUrl(profileUrl);
    } else if (profileUserId) {
      // If profileUserId is provided, it might be a username
      // Try to find user by username first
      const usersResponse = await db.get('/users', {
        params: {
          where: JSON.stringify({
            username: { $eq: profileUserId }
          })
        }
      });
      
      if (usersResponse.data?.data?.length) {
        profileUser = usersResponse.data.data[0];
      } else {
        return res.status(404).json({ 
          error: 'Profile user not found',
          searchedFor: profileUserId
        });
      }
    }
    
    if (!profileUser) {
      return res.status(404).json({ error: 'Profile user not found' });
    }
    if (!profileUser.url_id_text) {
      return res.status(400).json({ error: 'Profile user has no URL ID' });
    }

    // Create the card for the claiming user
    const card = await createCardService(userId, profileUser.url_id_text, {
      name: `${profileUser.username}'s Card`,
      description: `Profile access card for ${profileUser.username}`
    });

    // Activate and verify the card since it was claimed
    const activatedCard = await activateCard(userId, card.card_id);

    console.log('✅ Card claimed and activated successfully');

    // Generate QR code for response
    const qrCodeDataUrl = await QRCode.toDataURL(profileUser.url_id_text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    res.status(201).json({
      ...activatedCard,
      qr_code_image: qrCodeDataUrl,
      profile_user: {
        username: profileUser.username,
        email: profileUser.email
      }
    });
  } catch (error) {
    console.error('Error claiming card:', error);
    res.status(500).json({ error: 'Error claiming card' });
  }
}; 