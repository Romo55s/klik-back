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
      name: `Card ${profileUser.username}`,
      description: 'Professional digital card'
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

// Admin routes for card management
export const getAllCards = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 Admin: Getting all cards');

    // Get all cards - use created_at field to get all cards
    const cardsResponse = await db.get('/card', {
      params: {
        where: JSON.stringify({
          created_at: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });
    
    if (!cardsResponse.data?.data) {
      return res.json({ cards: [] });
    }

    const cards = cardsResponse.data.data;

    // Get user information for each card
    const cardsWithUsers = await Promise.all(
      cards.map(async (card: any) => {
        try {
          const userResponse = await db.get(`/users/${card.user_id}`);
          const user = userResponse.data?.data?.[0];
          return {
            ...card,
            user: user ? {
              user_id: user.user_id,
              username: user.username,
              email: user.email,
              role: user.role
            } : null
          };
        } catch (error) {
          console.error(`Error fetching user for card ${card.card_id}:`, error);
          return {
            ...card,
            user: null
          };
        }
      })
    );

    console.log(`✅ Admin: Retrieved ${cardsWithUsers.length} cards`);

    res.json({
      cards: cardsWithUsers,
      total: cardsWithUsers.length
    });
  } catch (error) {
    console.error('Error getting all cards:', error);
    res.status(500).json({ error: 'Error getting all cards' });
  }
};

export const getCardByIdAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cardId } = req.params;

    console.log('🔍 Admin: Getting card by ID:', cardId);

    const cardResponse = await db.get(`/card/${cardId}`);
    
    if (!cardResponse.data?.data?.[0]) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResponse.data.data[0];

    // Get user information
    const userResponse = await db.get(`/users/${card.user_id}`);
    const user = userResponse.data?.data?.[0];

    const cardWithUser = {
      ...card,
      user: user ? {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      } : null
    };

    console.log('✅ Admin: Retrieved card:', cardId);

    res.json(cardWithUser);
  } catch (error) {
    console.error('Error getting card by ID:', error);
    res.status(500).json({ error: 'Error getting card' });
  }
};

export const adminActivateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cardId } = req.params;
    const adminUserId = req.user?.user_id;

    console.log('🔍 Admin: Activating card:', cardId, 'by admin:', adminUserId);

    const cardResponse = await db.get(`/card/${cardId}`);
    
    if (!cardResponse.data?.data?.[0]) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResponse.data.data[0];

    // Activate the card
    const activatedCard = await activateCard(card.user_id, card.card_id);

    console.log('✅ Admin: Card activated successfully');

    res.json({
      message: 'Card activated successfully by admin',
      card: activatedCard
    });
  } catch (error) {
    console.error('Error activating card as admin:', error);
    res.status(500).json({ error: 'Error activating card' });
  }
};

export const adminDeactivateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cardId } = req.params;
    const adminUserId = req.user?.user_id;

    console.log('🔍 Admin: Deactivating card:', cardId, 'by admin:', adminUserId);

    const cardResponse = await db.get(`/card/${cardId}`);
    
    if (!cardResponse.data?.data?.[0]) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResponse.data.data[0];

    // Deactivate the card directly in database
    const deactivatedCard = await db.put(`/card/${card.user_id}/${card.card_id}`, {
      status: 'inactive',
      updated_at: new Date().toISOString()
    });

    console.log('✅ Admin: Card deactivated successfully');

    res.json({
      message: 'Card deactivated successfully by admin',
      card: deactivatedCard
    });
  } catch (error) {
    console.error('Error deactivating card as admin:', error);
    res.status(500).json({ error: 'Error deactivating card' });
  }
};

// Admin toggle card status (activate/deactivate)
export const adminToggleCardStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🔍 adminToggleCardStatus called with params:', req.params);
    console.log('🔍 adminToggleCardStatus called with body:', req.body);
    console.log('🔍 adminToggleCardStatus called with user:', req.user);
    
    const { cardId } = req.params;
    const { status } = req.body; // 'active' or 'inactive'
    const adminUserId = req.user?.user_id;

    console.log('🔍 Processing request:', { cardId, status, adminUserId });

    if (!status || !['active', 'inactive'].includes(status)) {
      console.log('❌ Invalid status provided:', status);
      return res.status(400).json({ error: 'Status must be either "active" or "inactive"' });
    }

    console.log('🔍 Admin: Toggling card status:', cardId, 'to:', status, 'by admin:', adminUserId);

    // Get all cards and find the one with matching card_id
    let cardResponse;
    try {
      cardResponse = await db.get('/card', {
        params: {
          where: JSON.stringify({
            created_at: { $gte: '2020-01-01T00:00:00.000Z' }
          })
        }
      });
      console.log('🔍 All cards query result:', cardResponse.data);
    } catch (error) {
      console.log('❌ Error getting all cards:', error);
      return res.status(404).json({ error: 'Card not found' });
    }
    
    // Find the card with matching card_id
    const allCards = cardResponse?.data?.data || [];
    const foundCard = allCards.find((c: any) => c.card_id === cardId);
    
    if (!foundCard) {
      console.log('❌ Card not found:', cardId);
      console.log('❌ Available card IDs:', allCards.map((c: any) => c.card_id));
      return res.status(404).json({ error: 'Card not found' });
    }

    console.log('🔍 Found card:', foundCard);

    // Update card status using the correct primary key structure
    const updatedCard = await db.put(`/card/${foundCard.user_id}/${foundCard.card_id}`, {
      status: status,
      updated_at: new Date().toISOString()
    });

    console.log('✅ Admin: Card status toggled successfully');

    res.json({
      message: `Card ${status === 'active' ? 'activated' : 'deactivated'} successfully by admin`,
      card: updatedCard.data
    });
  } catch (error) {
    console.error('❌ Error toggling card status as admin:', error);
    res.status(500).json({ error: 'Error toggling card status' });
  }
};

// Get card by username (authenticated users)
export const getCardByUsername = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.params;
    const requestingUserId = req.user?.user_id;

    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    console.log('🔍 Getting card for username:', username, 'requested by user:', requestingUserId);

    // First get the user by username
    const userResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          username: { $eq: username }
        })
      }
    });

    if (!userResponse.data?.data?.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResponse.data.data[0];

    // Get the user's cards
    const cardsResponse = await db.get('/card', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: user.user_id }
        })
      }
    });

    const cards = cardsResponse.data?.data || [];

    if (!cards.length) {
      return res.status(404).json({ error: 'No cards found for this user' });
    }

    // Return the first card (assuming one card per user)
    const card = cards[0];

    console.log('✅ Card retrieved for username:', username);

    res.json({
      card,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error getting card by username:', error);
    res.status(500).json({ error: 'Error getting card' });
  }
};

// Get public card status by username (no authentication required)
export const getPublicCardStatus = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    console.log('🔍 Getting public card status for username:', username);

    // First get the user by username
    const userResponse = await db.get('/users', {
      params: {
        where: JSON.stringify({
          username: { $eq: username }
        })
      }
    });

    if (!userResponse.data?.data?.length) {
      return res.json({ status: 'not_found' });
    }

    const user = userResponse.data.data[0];

    // Get the user's cards
    const cardsResponse = await db.get('/card', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: user.user_id }
        })
      }
    });

    const cards = cardsResponse.data?.data || [];

    if (!cards.length) {
      return res.json({ status: 'not_found' });
    }

    // Return only the status information (no sensitive data)
    const card = cards[0];

    console.log('✅ Public card status retrieved for username:', username);

    res.json({
      status: card.status
    });
  } catch (error) {
    console.error('Error getting public card status:', error);
    res.json({ status: 'not_found' });
  }
}; 