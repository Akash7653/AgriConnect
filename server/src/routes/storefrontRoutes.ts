import { Router } from 'express';
import { getStorefrontCampaigns } from '../controllers/storefrontController.js';

const router = Router();

router.get('/campaigns', getStorefrontCampaigns);

export default router;
