export type UserRole = 'user' | 'admin';

export interface User {
  user_id: string; // This will be a UUID
  email: string;
  profile_id?: string;
  url_id?: string;
  token_auth?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
} 