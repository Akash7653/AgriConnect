import { Router } from 'express';
import {
  askAgriAdvisor,
  getMarketSignals,
  getWeatherAlerts,
} from '../controllers/aiController.js';

const router = Router();

router.post('/advisor', askAgriAdvisor);
router.get('/market-signals', getMarketSignals);
router.get('/weather', getWeatherAlerts);

export default router;
