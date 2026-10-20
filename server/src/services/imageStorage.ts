import { createHash } from 'crypto';

export interface StoredImage {
  url: string;
  publicId: string;
  contentType: string;
  bytes: number;
  uploadedAt: Date;
}

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Product image uploads are not configured. Set the Cloudinary server credentials.');
  }
  return { cloudName, apiKey, apiSecret };
}

function signParameters(parameters: Record<string, string>, apiSecret: string): string {
  const canonical = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha1').update(`${canonical}${apiSecret}`).digest('hex');
}

export async function uploadProductImage(
  buffer: Buffer,
  contentType: string,
  farmerId: string,
  listingId: string,
): Promise<StoredImage> {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `agriconnect/crops/${farmerId}/${listingId}/${createHash('sha256').update(buffer).digest('hex').slice(0, 24)}`;
  const parameters = { folder: 'agriconnect/crops', public_id: publicId, timestamp };
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: contentType }), 'product-image');
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('folder', parameters.folder);
  form.append('public_id', publicId);
  form.append('signature', signParameters(parameters, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({})) as {
    secure_url?: string;
    public_id?: string;
    bytes?: number;
    error?: { message?: string };
  };
  if (!response.ok || !body.secure_url || !body.public_id) {
    throw new Error(body.error?.message || `Image provider rejected the upload (${response.status}).`);
  }

  return {
    url: body.secure_url,
    publicId: body.public_id,
    contentType,
    bytes: body.bytes ?? buffer.byteLength,
    uploadedAt: new Date(),
  };
}

export async function deleteProductImage(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parameters = { public_id: publicId, timestamp };
  const form = new FormData();
  form.append('api_key', apiKey);
  form.append('public_id', publicId);
  form.append('timestamp', timestamp);
  form.append('signature', signParameters(parameters, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({})) as { result?: string; error?: { message?: string } };
  if (!response.ok || (body.result !== 'ok' && body.result !== 'not found')) {
    throw new Error(body.error?.message || `Image provider rejected the deletion (${response.status}).`);
  }
}
