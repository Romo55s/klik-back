import mongoose, { Document, Schema } from 'mongoose';

export interface ICard extends Document {
  cardId: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

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