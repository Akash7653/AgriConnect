import { Router } from 'express';
import { getStorefrontCampaigns, getStorefrontProducts } from '../controllers/storefrontController.js';

const router = Router();

router.get('/campaigns', getStorefrontCampaigns);
router.get('/products', getStorefrontProducts);

export default router;
