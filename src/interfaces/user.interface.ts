export type UserRole = 'user' | 'admin';

export interface User {
  user_id: string; // This will be a UUID
  email: string;
  username: string; // Added username field
  profile_id?: string;
  url_id_text: string; // Required field for profile URL
  token_auth?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  profile_id: string;
  user_id: string;
  name: string;
  bio: string;
  avatar_url?: string;
  links?: Map<string, string>; // Map of link name to URL (e.g., "LinkedIn" -> "https://linkedin.com/in/username")
  created_at: string;
  updated_at: string;
}

export interface ProfileFormData {
  name: string;
  username: string;
  bio: string;
  avatar_url?: string;
  links?: Map<string, string>; // Added links field
} 