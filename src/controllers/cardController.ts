import { Response } from 'express';
import Card from '../models/Card';
import { ICard } from '../interfaces/card.interface';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';

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