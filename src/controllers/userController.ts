import { Response } from 'express';
import { Request } from 'express';
import { User, findOrCreateUser, updateUser, deleteUser, getUserById, getAllUsers } from '../services/userService';
import { AuthResult } from 'express-oauth2-jwt-bearer';

interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthResult;
}

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
};

export const updateCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { email } = req.body;
    const updatedUser = await updateUser(req.user.user_id, { email });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Error updating user' });
  }
};

export const deleteCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await deleteUser(req.user.user_id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting user' });
  }
};

// Admin routes
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
};

export const getUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
}; 