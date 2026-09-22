/**
 * Unit tests for POST /api/run-model endpoint in server.ts
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createServer } from '../server.js';

describe('POST /api/run-model', () => {
  const app = createServer();

  it('fails if prompt is missing', async () => {
    const res = await request(app)
      .post('/api/run-model')
      .send({ model_id: 'gemini-3.6-flash' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Prompt/i);
  });

  it('successfully executes a cloud Gemini model with prompt and returns output', async () => {
    const res = await request(app)
      .post('/api/run-model')
      .send({
        model_id: 'gemini-3.6-flash',
        prompt: 'Summarize the payment terms in section 3.',
        data_sensitivity: 'internal',
      });

    expect(res.status).toBe(200);
    expect(res.body.model_id).toBe('gemini-3.6-flash');
    expect(res.body.location).toBe('cloud');
    expect(res.body.output).toBeDefined();
    expect(typeof res.body.output).toBe('string');
    expect(res.body.output.length).toBeGreaterThan(10);
    expect(res.body.input_tokens).toBeGreaterThan(0);
    expect(res.body.output_tokens).toBeGreaterThan(0);
    expect(res.body.actual_latency_ms).toBeGreaterThan(0);
  });

  it('successfully executes a local model with prompt and returns output', async () => {
    const res = await request(app)
      .post('/api/run-model')
      .send({
        model_id: 'phi3:latest',
        prompt: 'Explain the difference between local and cloud computing.',
        data_sensitivity: 'internal',
      });

    expect(res.status).toBe(200);
    expect(res.body.model_id).toBe('phi3:latest');
    expect(res.body.location).toBe('local');
    expect(res.body.output).toBeDefined();
    expect(typeof res.body.output).toBe('string');
    expect(res.body.output.length).toBeGreaterThan(10);
  });

  it('enforces Invariant 2 by blocking cloud models when data_sensitivity is pii', async () => {
    const res = await request(app)
      .post('/api/run-model')
      .send({
        model_id: 'gemini-3.6-flash',
        prompt: 'Contains raw SSN 000-12-3456',
        data_sensitivity: 'pii',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invariant 2 Violation');
  });

  it('allows local models when data_sensitivity is pii', async () => {
    const res = await request(app)
      .post('/api/run-model')
      .send({
        model_id: 'phi3:latest',
        prompt: 'Contains raw SSN 000-12-3456',
        data_sensitivity: 'pii',
      });

    expect(res.status).toBe(200);
    expect(res.body.model_id).toBe('phi3:latest');
    expect(res.body.output).toBeDefined();
  });
});
