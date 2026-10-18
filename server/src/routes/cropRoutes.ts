import { Router } from 'express';
import {
  createListing,
  getListings,
  getListingById,
  getFarmerListings,
  updateListing,
  deleteListing,
} from '../controllers/cropController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public marketplace queries
router.get('/', getListings);
router.get('/detail/:id', getListingById);

// Farmer specific
router.get('/my-crops', authenticateToken, getFarmerListings);
router.post('/', authenticateToken, createListing);
router.put('/:id', authenticateToken, updateListing);
router.delete('/:id', authenticateToken, deleteListing);

export default router;
