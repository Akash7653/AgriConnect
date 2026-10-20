import { Router } from 'express';
import { getServiceability } from '../controllers/serviceabilityController.js';

const router = Router();

router.get('/', getServiceability);

export default router;
