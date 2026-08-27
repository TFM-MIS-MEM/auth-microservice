const request = require('supertest');
const app = require('../src/app');

describe('Health Check Endpoint', () => {
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('message', 'Health check successful');
    });

    it('should return uptime, timestamp, version, environment and db status', async () => {
      const res = await request(app).get('/health');

      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');

      expect(res.body).toHaveProperty('timestamp');
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);

      expect(res.body).toHaveProperty('version');
      expect(typeof res.body.version).toBe('string');

      expect(res.body).toHaveProperty('environment');
      expect(typeof res.body.environment).toBe('string');

      expect(res.body).toHaveProperty('db');
      expect(['connected', 'disconnected']).toContain(res.body.db);
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 with error report format', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body).toHaveProperty('message');
    });
  });
});
