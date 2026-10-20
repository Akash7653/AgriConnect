import { Request, Response } from 'express';
import { z } from 'zod';
import { GeocodingError, reverseGeocode } from '../services/geocoding.js';

const coordinate = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number),
]).pipe(z.number().finite());

const coordinatesSchema = z.object({
  latitude: coordinate.optional(),
  longitude: coordinate.optional(),
  lat: coordinate.optional(),
  lon: coordinate.optional(),
}).passthrough().superRefine((value, context) => {
  const latitude = value.latitude ?? value.lat;
  const longitude = value.longitude ?? value.lon;
  if (latitude === undefined || latitude < -90 || latitude > 90) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'Latitude must be between -90 and 90.' });
  }
  if (longitude === undefined || longitude < -180 || longitude > 180) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['longitude'], message: 'Longitude must be between -180 and 180.' });
  }
});

export async function reverseGeocodeLocation(req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();
  const coordinates = coordinatesSchema.safeParse(req.body);
  if (!coordinates.success) {
    res.status(400).json({
      success: false,
      message: 'Location coordinates are invalid. Allow location access or enter your address manually.',
    });
    return;
  }

  try {
    const latitude = coordinates.data.latitude ?? coordinates.data.lat;
    const longitude = coordinates.data.longitude ?? coordinates.data.lon;
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({
        success: false,
        message: 'Location coordinates are invalid. Allow location access or enter your address manually.',
      });
      return;
    }
    const address = await reverseGeocode(latitude, longitude);
    res.json({ success: true, address });
  } catch (error) {
    if (error instanceof GeocodingError) {
      if (error.retryAfterSeconds !== undefined) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      res.status(error.statusCode).json({
        success: false,
        code: `LOCATION_${error.category.toUpperCase()}`,
        message: error.message,
      });
      return;
    }

    console.error('[location] Reverse-geocoding request failed', {
      category: 'internal_error',
      durationMs: Date.now() - startedAt,
    });
    res.status(502).json({
      success: false,
      code: 'LOCATION_LOOKUP_FAILED',
      message: 'Location lookup is temporarily unavailable. Enter your address manually.',
    });
  }
}
