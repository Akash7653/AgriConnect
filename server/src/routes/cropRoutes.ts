import { NextFunction, Request, Response, Router } from 'express';
import multer, { MulterError } from 'multer';
import {
  createListing,
  getListings,
  getListingById,
  getFarmerListings,
  updateListing,
  deleteListing,
  uploadListingImage,
  removeListingImage,
} from '../controllers/cropController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new Error('Choose a JPEG, PNG, or WebP product image.'));
      return;
    }
    callback(null, true);
  },
});

function handleProductImageUpload(req: Request, res: Response, next: NextFunction): void {
  productImageUpload.single('image')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const isTooLarge = error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE';
    res.status(isTooLarge ? 413 : 400).json({
      success: false,
      message: isTooLarge ? 'Product images must be 5 MB or smaller.' : error instanceof Error ? error.message : 'Image upload failed.',
    });
  });
}

// Marketplace inventory is for buyer accounts only.
router.get('/', authenticateToken, requireRole(USER_ROLES.BUYER, USER_ROLES.BUSINESS), getListings);
router.get('/detail/:id', authenticateToken, requireRole(USER_ROLES.BUYER, USER_ROLES.BUSINESS), getListingById);

// Farmer specific
router.get('/my-crops', authenticateToken, requireRole(USER_ROLES.FARMER), getFarmerListings);
router.post('/', authenticateToken, createListing);
router.put('/:id', authenticateToken, updateListing);
router.delete('/:id', authenticateToken, deleteListing);
router.post('/:id/images', authenticateToken, requireRole(USER_ROLES.FARMER), handleProductImageUpload, uploadListingImage);
router.delete('/:id/images', authenticateToken, requireRole(USER_ROLES.FARMER), removeListingImage);

export default router;
