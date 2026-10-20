import { Router } from 'express';
import {
  askAgriAdvisor,
  getAdvisorStatus,
  getMarketSignals,
  getWeatherAlerts,
} from '../controllers/aiController.js';

const router = Router();

router.get('/status', getAdvisorStatus);
router.post('/advisor', askAgriAdvisor);
router.get('/market-signals', getMarketSignals);
router.get('/weather', getWeatherAlerts);

export default router;
