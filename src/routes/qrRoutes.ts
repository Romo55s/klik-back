import express from 'express';
import { verifyCardByQr } from '../controllers/qrController';

const router = express.Router();
router.post('/verify-card', verifyCardByQr);
export default router; 