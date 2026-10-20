import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('browser origin allowlist', () => {
  it('allows the deployed Vercel origin to complete API preflight requests', async () => {
    const response = await request(app)
      .options('/api/crops')
      .set('Origin', 'https://agri-connect-seven-snowy.vercel.app')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://agri-connect-seven-snowy.vercel.app');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
