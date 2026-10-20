import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';

const originalEnv = {
  xaiApiKey: process.env.XAI_API_KEY,
  grokApiKey: process.env.GROK_API_KEY,
  xaiModel: process.env.XAI_MODEL,
  nodeEnv: process.env.NODE_ENV,
};

beforeAll(async () => {
  await connectDB();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalEnv.xaiApiKey === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = originalEnv.xaiApiKey;
  if (originalEnv.grokApiKey === undefined) delete process.env.GROK_API_KEY;
  else process.env.GROK_API_KEY = originalEnv.grokApiKey;
  if (originalEnv.xaiModel === undefined) delete process.env.XAI_MODEL;
  else process.env.XAI_MODEL = originalEnv.xaiModel;
  if (originalEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.nodeEnv;
});

afterAll(async () => {
  await disconnectDB();
});

describe('AgriConnect xAI advisor', () => {
  it('reports configuration without calling the paid inference API', async () => {
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/ai/status');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, provider: 'xAI', configured: false, model: 'grok-4.7' });
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.XAI_API_KEY = 'configured-test-key';
    const configured = await request(app).get('/api/ai/status');
    expect(configured.body.configured).toBe(true);
    expect(JSON.stringify(configured.body)).not.toContain('configured-test-key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects empty and malformed prompts before calling xAI', async () => {
    process.env.XAI_API_KEY = 'test-xai-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const empty = await request(app).post('/api/ai/advisor').send({ prompt: '   ' });
    const malformed = await request(app).post('/api/ai/advisor').send({ prompt: 'How?', unexpected: true });

    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('INVALID_REQUEST');
    expect(malformed.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the documented xAI chat endpoint, server-side bearer key, and current model', async () => {
    process.env.XAI_API_KEY = 'test-xai-key';
    process.env.XAI_MODEL = 'grok-4.7';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Inspect the plant and consult a local agricultural officer.' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'request-id': 'xai-test-request-1' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'Tomato leaves have spots. What should I check?', language: 'en' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('Grok');
    expect(response.body.response).toContain('Inspect the plant');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-xai-key' }),
        body: expect.stringContaining('"model":"grok-4.7"'),
        signal: expect.any(AbortSignal),
      })
    );
    expect(JSON.stringify(response.body)).not.toContain('test-xai-key');
  });

  it.each([
    [401, 'INVALID_CREDENTIALS'],
    [404, 'MODEL_OR_ENDPOINT_UNAVAILABLE'],
    [429, 'QUOTA_OR_BILLING'],
    [503, 'PROVIDER_UNAVAILABLE'],
  ])('returns sanitized diagnostics for xAI HTTP %i', async (status, code) => {
    process.env.XAI_API_KEY = 'test-xai-key';
    const providerError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('provider error', {
      status,
      headers: { 'request-id': 'provider-request-42' },
    })));

    const response = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'What should I observe in my crop?', language: 'en' });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe(code);
    expect(response.body.message).toContain(`HTTP ${status}`);
    expect(response.body.requestId).toBe('provider-request-42');
    expect(providerError).toHaveBeenCalledWith('xAI advisor request failed', {
      category: code.toLowerCase(),
      status,
      requestId: 'provider-request-42',
    });
    expect(JSON.stringify(response.body)).not.toContain('test-xai-key');
  });

  it('returns a friendly production error and does not expose provider diagnostics', async () => {
    process.env.NODE_ENV = 'production';
    process.env.XAI_API_KEY = 'test-xai-key';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('provider error', {
      status: 401,
      headers: { 'request-id': 'provider-request-99' },
    })));

    const response = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'What should I observe in my crop?', language: 'en' });

    expect(response.status).toBe(502);
    expect(response.body.message).toContain('temporarily unavailable');
    expect(response.body.message).not.toContain('HTTP 401');
    expect(response.body.requestId).toBe('provider-request-99');
  });

  it('rejects malformed provider JSON with a retryable safe error', async () => {
    process.env.XAI_API_KEY = 'test-xai-key';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', {
      status: 200,
      headers: { 'request-id': 'provider-request-invalid-json' },
    })));

    const response = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'How do I inspect the crop?', language: 'en' });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('INVALID_RESPONSE');
    expect(response.body.requestId).toBe('provider-request-invalid-json');
  });

  it('reports missing credentials and provider timeouts without logging prompts or keys', async () => {
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const missing = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'Private crop information', language: 'en' });

    expect(missing.status).toBe(503);
    expect(missing.body.code).toBe('MISSING_CREDENTIALS');
    expect(logError).toHaveBeenCalledWith('xAI advisor request failed', { category: 'missing_credentials' });

    process.env.XAI_API_KEY = 'test-xai-key';
    const timeout = Object.assign(new Error('request timed out'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    const timedOut = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'Private crop information', language: 'en' });

    expect(timedOut.status).toBe(502);
    expect(timedOut.body.code).toBe('TIMEOUT');
    expect(logError.mock.calls.flat().join(' ')).not.toContain('Private crop information');
    expect(logError.mock.calls.flat().join(' ')).not.toContain('test-xai-key');
  });
});
