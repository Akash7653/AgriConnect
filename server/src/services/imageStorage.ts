import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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
  if (!cloudName && !apiKey && !apiSecret) return undefined;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary image configuration is incomplete. Set all three server credentials or remove them to use database storage.');
  }
  return { cloudName, apiKey, apiSecret };
}

function productImageBucket() {
  const database = mongoose.connection.db;
  if (!database) throw new Error('Product image storage is unavailable because the database is not connected.');
  return new mongoose.mongo.GridFSBucket(database, { bucketName: 'productImages' });
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
  apiOrigin: string,
): Promise<StoredImage> {
  const cloudinary = cloudinaryConfig();
  if (!cloudinary) {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const bucket = productImageBucket();
    const upload = bucket.openUploadStream(hash, {
      metadata: { contentType, farmerId, listingId, hash },
    });
    await pipeline(Readable.from([buffer]), upload);
    const publicId = `gridfs:${upload.id.toString()}`;
    return {
      url: `${apiOrigin}/api/crops/images/${upload.id.toString()}`,
      publicId,
      contentType,
      bytes: buffer.byteLength,
      uploadedAt: new Date(),
    };
  }

  const { cloudName, apiKey, apiSecret } = cloudinary;
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
  if (publicId.startsWith('gridfs:')) {
    const id = publicId.slice('gridfs:'.length);
    if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Stored product image identifier is invalid.');
    await productImageBucket().delete(new mongoose.mongo.ObjectId(id));
    return;
  }

  const cloudinary = cloudinaryConfig();
  if (!cloudinary) {
    throw new Error('Cloudinary credentials are required to delete this legacy product image.');
  }
  const { cloudName, apiKey, apiSecret } = cloudinary;
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

export async function openProductImage(publicId: string): Promise<{
  stream: ReturnType<ReturnType<typeof productImageBucket>['openDownloadStream']>;
  contentType: string;
  bytes: number;
} | undefined> {
  if (!/^[a-f\d]{24}$/i.test(publicId)) return undefined;
  const id = new mongoose.mongo.ObjectId(publicId);
  const bucket = productImageBucket();
  const file = await bucket.find({ _id: id }).next();
  if (!file) return undefined;
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const storedType = file.metadata?.contentType;
  return {
    stream: bucket.openDownloadStream(id),
    contentType: typeof storedType === 'string' && allowedTypes.has(storedType) ? storedType : 'application/octet-stream',
    bytes: file.length,
  };
}
