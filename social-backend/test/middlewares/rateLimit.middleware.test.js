import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.resetModules();
    // Khởi tạo các biến môi trường cấu hình test
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1 giây
    process.env.RATE_LIMIT_MAX = '3';          // Giới hạn 3 reqs
    process.env.REDIS_ENABLED = 'false';       // Chạy bằng MemoryStore để tránh ảnh hưởng bởi cụm Redis thật
  });

  it('should allow requests under the limit when enabled', async () => {
    const { globalLimiter } = await import('../../middlewares/rateLimit/rateLimit.middleware.js');
    const app = express();
    app.use(globalLimiter);
    app.get('/test', (req, res) => res.status(200).send('OK'));

    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });

  it('should block requests exceeding the limit when enabled', async () => {
    const { globalLimiter } = await import('../../middlewares/rateLimit/rateLimit.middleware.js');
    const app = express();
    app.use(globalLimiter);
    app.get('/test', (req, res) => res.status(200).send('OK'));

    // Send 3 requests (trong giới hạn)
    await request(app).get('/test');
    await request(app).get('/test');
    await request(app).get('/test');

    // Request thứ 4 phải bị block
    const response = await request(app).get('/test');
    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      status: 429,
      error: 'Too Many Requests',
      message: 'Hệ thống phát hiện tần suất thao tác quá nhanh. Vui lòng lướt chậm lại một chút để bảo vệ tài nguyên!'
    });
  });

  it('should not block requests if disabled', async () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    const { globalLimiter } = await import('../../middlewares/rateLimit/rateLimit.middleware.js');
    
    const app = express();
    app.use(globalLimiter);
    app.get('/test', (req, res) => res.status(200).send('OK'));

    // Gửi liên tiếp 5 requests (vượt ngưỡng 3 cũ)
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    }
  });

  it('should skip rate limiting for the /health endpoint', async () => {
    const { globalLimiter } = await import('../../middlewares/rateLimit/rateLimit.middleware.js');
    const app = express();
    app.use(globalLimiter);
    app.get('/health', (req, res) => res.status(200).send('OK'));

    // Gửi 5 requests đến health check, không được bị chặn
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    }
  });
});
