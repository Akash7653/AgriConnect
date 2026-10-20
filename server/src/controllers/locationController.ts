import { Request, Response } from 'express';
import { z } from 'zod';
import { GeocodingError, reverseGeocode } from '../services/geocoding.js';

const coordinatesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
}).strict();

export async function reverseGeocodeLocation(req: Request, res: Response): Promise<void> {
  const coordinates = coordinatesSchema.safeParse(req.body);
  if (!coordinates.success) {
    res.status(400).json({ success: false, message: 'Provide valid latitude and longitude.' });
    return;
  }

  try {
    const address = await reverseGeocode(coordinates.data.latitude, coordinates.data.longitude);
    res.json({ success: true, address });
  } catch (error) {
    if (error instanceof GeocodingError) {
      console.warn(`[location] Reverse-geocoding failed (${error.statusCode})`);
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }

    console.error('[location] Reverse-geocoding request failed');
    res.status(502).json({
      success: false,
      message: 'Location lookup is temporarily unavailable. Enter your address manually.',
    });
  }
}
