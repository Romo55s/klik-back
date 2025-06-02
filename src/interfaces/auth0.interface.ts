export interface Auth0Payload {
  sub: string;
  email?: string;
}

export interface Auth0UserInfo {
  email: string;
  picture?: string;
  name?: string;
} 