import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';

let originalApiKey: string | undefined;
let originalModel: string | undefined;

beforeAll(async () => {
  originalApiKey = process.env.GROK_API_KEY;
  originalModel = process.env.GROK_MODEL;
  await connectDB();
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.GROK_API_KEY;
  else process.env.GROK_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.GROK_MODEL;
  else process.env.GROK_MODEL = originalModel;
});

afterAll(async () => {
  await disconnectDB();
});

describe('AgriConnect Grok advisor', () => {
  it('returns a multilingual general-guidance fallback when the API key is missing', async () => {
    delete process.env.GROK_API_KEY;

    const response = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'టమోటా ఆకులపై మచ్చలు ఉన్నాయి', language: 'te' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('general-guidance');
    expect(response.body.fallback).toBe(true);
    expect(response.body.response).toContain('వ్యవసాయ');
  });

  it('keeps the Grok key server-side and returns the configured model response', async () => {
    process.env.GROK_API_KEY = 'unit-test-key';
    process.env.GROK_MODEL = 'grok-test-model';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Check leaf undersides and seek local extension advice.' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'How should I inspect tomato leaf spots?', language: 'en' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('Grok');
    expect(response.body.fallback).toBe(false);
    expect(response.body.response).toContain('leaf undersides');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer unit-test-key' }),
        body: expect.stringContaining('"model":"grok-test-model"'),
      })
    );
    expect(JSON.stringify(response.body)).not.toContain('unit-test-key');
  });

  it('falls back when the Grok API is unavailable', async () => {
    process.env.GROK_API_KEY = 'unit-test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('provider unavailable', { status: 503 })));

    const response = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'How do I improve soil?', language: 'en' });

    expect(response.status).toBe(200);
    expect(response.body.fallback).toBe(true);
    expect(response.body.provider).toBe('general-guidance');
  });
});
