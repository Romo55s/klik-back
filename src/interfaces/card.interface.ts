export interface Card {
  user_id: string;
  card_id: string;
  name: string;
  description: string;
  status: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCardDto {
  name?: string;
  description?: string;
}

export interface UpdateCardDto {
  name?: string;
  description?: string;
  status?: string;
  is_verified?: boolean;
} 