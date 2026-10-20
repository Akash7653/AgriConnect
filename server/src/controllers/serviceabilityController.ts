import { Request, Response } from 'express';
import { z } from 'zod';
import { checkServiceability } from '../services/serviceability.js';

const serviceabilityQuerySchema = z.object({
  city: z.string().min(2),
  state: z.string().min(2),
  pinCode: z.string().min(5),
});

export async function getServiceability(req: Request, res: Response): Promise<void> {
  try {
    const address = serviceabilityQuerySchema.parse(req.query);
    const result = await checkServiceability(address);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
