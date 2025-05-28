import mongoose, { Schema } from 'mongoose';
import { ICard } from '../interfaces/card.interface';

const CardSchema = new Schema({
  cardId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
}, {
  timestamps: true,
});

export default mongoose.model<ICard>('Card', CardSchema); 