import { Response } from 'express';
import { User } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { AuthResult } from 'express-oauth2-jwt-bearer';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

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

    const response = await db.post('/scanlog', scanLog);
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

    // Get scan logs for the user using scan_time index
    const response = await db.get('/scanlog', {
      params: {
        where: JSON.stringify({
          scan_time: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });

    // Filter the results to only include logs for this user
    const userScanLogs = response.data?.data?.filter((log: any) => log.user_id === userId) || [];
    
    res.json({
      data: userScanLogs,
      count: userScanLogs.length
    });
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

    const response = await db.get(`/scanlog/${id}`);
    
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
    const getResponse = await db.get(`/scanlog/${id}`);
    
    if (!getResponse.data) {
      return res.status(404).json({ error: 'Scan log not found' });
    }

    if (getResponse.data.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.delete(`/scanlog/${id}`);
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
    // Get all scan logs - use scan_time field to get all scan logs
    const response = await db.get('/scanlog', {
      params: {
        where: JSON.stringify({
          scan_time: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });
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

    // Get scan logs using scan_time index and filter by card_id and user_id
    const response = await db.get('/scanlog', {
      params: {
        where: JSON.stringify({
          scan_time: { $gte: '2020-01-01T00:00:00.000Z' }
        })
      }
    });

    // Filter the results to only include logs for this card and user
    const cardScanLogs = response.data?.data?.filter((log: any) => 
      log.card_id === card_id && log.user_id === userId
    ) || [];
    
    res.json({
      data: cardScanLogs,
      count: cardScanLogs.length
    });
  } catch (error) {
    console.error('Error fetching scan logs:', error);
    res.status(500).json({ error: 'Error fetching scan logs' });
  }
}; 