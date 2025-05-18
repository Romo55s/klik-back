import { Response } from 'express';
import { Request } from 'express';
import { User } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

export const createScanLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { card_id, scan_type, location, device_info } = req.body;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!card_id) {
      return res.status(400).json({ error: 'Card ID is required' });
    }

    const now = new Date().toISOString();
    const scanLog = {
      scan_id: uuidv4(),
      user_id: userId,
      card_id,
      scan_type: scan_type || 'nfc',
      location: location || null,
      device_info: device_info || null,
      created_at: now
    };

    const response = await db.post('/scan_logs', scanLog);
    console.log('✅ Scan log created:', response.data);

    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error creating scan log:', error);
    res.status(500).json({ error: 'Error creating scan log' });
  }
};

export const getScanLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const response = await db.get('/scan_logs', {
      params: {
        where: JSON.stringify({
          user_id: { $eq: userId }
        }),
        'allow-filtering': 'true'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching scan logs:', error);
    res.status(500).json({ error: 'Error fetching scan logs' });
  }
};

export const getScanLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const response = await db.get(`/scan_logs/${id}`);
    
    if (!response.data) {
      return res.status(404).json({ error: 'Scan log not found' });
    }

    // Verify the scan log belongs to the user
    if (response.data.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching scan log:', error);
    res.status(500).json({ error: 'Error fetching scan log' });
  }
};

export const deleteScanLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First get the scan log to verify ownership
    const getResponse = await db.get(`/scan_logs/${id}`);
    
    if (!getResponse.data) {
      return res.status(404).json({ error: 'Scan log not found' });
    }

    if (getResponse.data.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.delete(`/scan_logs/${id}`);
    console.log('✅ Scan log deleted');

    res.json({ message: 'Scan log deleted successfully' });
  } catch (error) {
    console.error('Error deleting scan log:', error);
    res.status(500).json({ error: 'Error deleting scan log' });
  }
};

// Admin routes
export const getAllScanLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const response = await db.get('/scan_logs');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching scan logs:', error);
    res.status(500).json({ error: 'Error fetching scan logs' });
  }
};

export const getScanLogsByCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { card_id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const response = await db.get('/scan_logs', {
      params: {
        where: JSON.stringify({
          card_id: { $eq: card_id },
          user_id: { $eq: userId }
        }),
        'allow-filtering': 'true'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching scan logs:', error);
    res.status(500).json({ error: 'Error fetching scan logs' });
  }
}; 