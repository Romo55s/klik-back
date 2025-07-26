import { Request, Response } from 'express';
import { getUserByProfileUrl } from '../services/userService';

export const verifyCardByQr = async (req: Request, res: Response) => {
  try {
    const { profileUrl } = req.body;

    if (!profileUrl) {
      return res.status(400).json({ error: 'profileUrl required' });
    }

    // Use the service to get a single user by profileUrl
    const user = await getUserByProfileUrl(profileUrl);
    if (!user) {
      console.error('[QR VERIFY] No user found for profileUrl:', profileUrl);
      return res.status(404).json({ error: 'User not found' });
    }

    // Return profile information for the claim page
    // NO card creation happens here
    res.json({ 
      success: true, 
      message: 'QR code verified successfully',
      profile: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        profile_url: profileUrl
      }
    });
  } catch (error) {
    console.error('[QR VERIFY] Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}; 