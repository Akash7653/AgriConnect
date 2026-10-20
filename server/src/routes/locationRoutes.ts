import { Router } from 'express';
import { reverseGeocodeLocation } from '../controllers/locationController.js';

const router = Router();

router.post('/reverse-geocode', reverseGeocodeLocation);

export default router;
