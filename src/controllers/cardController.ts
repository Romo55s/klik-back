import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { CreateCardDto, Card } from '../interfaces/card.interface';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { createCard as createCardService, activateCard, getCardByUserId, getCardById } from '../services/cardService';

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
    if (!user.url_id_text) {
      return res.status(400).json({ error: 'User has no URL ID' });
    }

    const card = await createCardService(userId, user.url_id_text, cardData);
    console.log('✅ Card created');

    // Generate QR code for response
    const profileUrl = user.url_id_text;
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
    const profileUrl = user.url_id_text;
    
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
    const profileUrl = user.url_id_text;
    
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

export const claimCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { profileUserId } = req.body; // The user ID whose card is being claimed

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!profileUserId) {
      return res.status(400).json({ error: 'profileUserId is required' });
    }

    // Get the profile user's information
    const profileUserResponse = await db.get(`/users/${profileUserId}`);
    if (!profileUserResponse.data) {
      return res.status(404).json({ error: 'Profile user not found' });
    }

    const profileUser = profileUserResponse.data;
    if (!profileUser.url_id_text) {
      return res.status(400).json({ error: 'Profile user has no URL ID' });
    }

    // Check if user already has cards for this profile
    const existingCards = await getCardByUserId(userId);
    const existingCardsForProfile = existingCards.filter(card => 
      card.name.includes(profileUser.username)
    );

    // If user already has cards for this profile, return them instead of creating new ones
    if (existingCardsForProfile.length > 0) {
      console.log(`✅ User already has ${existingCardsForProfile.length} card(s) for this profile`);
      
      // Generate QR codes for existing cards
      const cardsWithQR = await Promise.all(
        existingCardsForProfile.map(async (card) => {
          const qrCodeDataUrl = await QRCode.toDataURL(profileUser.url_id_text, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300
          });
          return {
            ...card,
            qr_code_image: qrCodeDataUrl
          };
        })
      );

      return res.status(200).json({ 
        message: 'You already have cards for this profile',
        cards: cardsWithQR,
        profile_user: {
          username: profileUser.username,
          email: profileUser.email
        }
      });
    }

    // Create the card for the claiming user
    const card = await createCardService(userId, profileUser.url_id_text, {
      name: `${profileUser.username}'s Card`,
      description: `Profile access card for ${profileUser.username}`
    });

    console.log('✅ Card claimed successfully');

    // Generate QR code for response
    const qrCodeDataUrl = await QRCode.toDataURL(profileUser.url_id_text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    res.status(201).json({
      ...card,
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

export const getCardsByProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { profileUsername } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!profileUsername) {
      return res.status(400).json({ error: 'profileUsername is required' });
    }

    // Get all user's cards
    const allCards = await getCardByUserId(userId);
    
    // Filter cards for the specific profile
    const profileCards = allCards.filter(card => 
      card.name.includes(profileUsername)
    );

    if (profileCards.length === 0) {
      return res.status(404).json({ 
        message: 'No cards found for this profile',
        cards: []
      });
    }

    // Generate QR codes for all profile cards
    const cardsWithQR = await Promise.all(
      profileCards.map(async (card) => {
        // Use a default profile URL since we don't store it in the card
        const profileUrl = `https://yourdomain.com/profile/${profileUsername}`;
          
        const qrCodeDataUrl = await QRCode.toDataURL(profileUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 300
        });
        
        return {
          ...card,
          qr_code_image: qrCodeDataUrl
        };
      })
    );

    res.json({
      profile_username: profileUsername,
      total_cards: cardsWithQR.length,
      cards: cardsWithQR
    });
  } catch (error) {
    console.error('Error fetching cards by profile:', error);
    res.status(500).json({ error: 'Error fetching cards by profile' });
  }
};

export const createAdditionalCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { profileUserId, cardName, description } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!profileUserId) {
      return res.status(400).json({ error: 'profileUserId is required' });
    }

    // Get the profile user's information
    const profileUserResponse = await db.get(`/users/${profileUserId}`);
    if (!profileUserResponse.data) {
      return res.status(404).json({ error: 'Profile user not found' });
    }

    const profileUser = profileUserResponse.data;
    if (!profileUser.url_id_text) {
      return res.status(400).json({ error: 'Profile user has no URL ID' });
    }

    // Create a new card with custom name/description
    const cardNameToUse = cardName || `${profileUser.username}'s Card ${new Date().toISOString().slice(0, 10)}`;
    const descriptionToUse = description || `Additional profile access card for ${profileUser.username}`;

    const card = await createCardService(userId, profileUser.url_id_text, {
      name: cardNameToUse,
      description: descriptionToUse
    });

    console.log('✅ Additional card created successfully');

    // Generate QR code for response
    const qrCodeDataUrl = await QRCode.toDataURL(profileUser.url_id_text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    res.status(201).json({
      ...card,
      qr_code_image: qrCodeDataUrl,
      profile_user: {
        username: profileUser.username,
        email: profileUser.email
      }
    });
  } catch (error) {
    console.error('Error creating additional card:', error);
    res.status(500).json({ error: 'Error creating additional card' });
  }
}; 