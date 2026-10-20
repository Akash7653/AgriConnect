import { Request, Response } from 'express';
import { z } from 'zod';
import { reverseGeocode } from '../services/geocoding.js';

const coordinatesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export async function reverseGeocodeLocation(req: Request, res: Response): Promise<void> {
  try {
    const { latitude, longitude } = coordinatesSchema.parse(req.body);
    const address = await reverseGeocode(latitude, longitude);
    res.json({ success: true, address });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Could not resolve this location.' });
  }
}
