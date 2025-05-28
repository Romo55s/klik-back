import { Document } from 'mongoose';

export interface ICard extends Document {
  cardId: string;
  userId: string;
  name: string; 
  description?: string;
  createdAt: Date;
  updatedAt: Date;
} 