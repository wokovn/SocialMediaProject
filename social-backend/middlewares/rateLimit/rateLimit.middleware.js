import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redis, { isRedisEnabled } from '../../infra/redis/redis.config.js';

// Cấu hình các biến từ process.env
const ENABLED = process.env.RATE_LIMIT_ENABLED === 'true';

// 1. API Chung (Mặc định 300 requests / 5 phút ~ 60/phút)
const GLOBAL_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000;
const GLOBAL_MAX = Number(process.env.RATE_LIMIT_MAX) || 300;

// 2. Auth API (Mặc định 15 requests / 15 phút)
const AUTH_WINDOW = Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000;
const AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX) || 15;

// 3. Media API (Mặc định 20 uploads / 15 phút)
const MEDIA_WINDOW = Number(process.env.RATE_LIMIT_MEDIA_WINDOW_MS) || 15 * 60 * 1000;
const MEDIA_MAX = Number(process.env.RATE_LIMIT_MEDIA_MAX) || 20;

/**
 * Hàm khởi tạo bộ kiểm soát tần suất động
 */
function createLimiter({ prefix, windowMs, max, errorMessage }) {
  // Nếu tính năng bị tắt trong config/env, bỏ qua qua
  if (!ENABLED) {
    return (req, res, next) => next();
  }

  let store;

  // Sử dụng Redis Store nếu Redis khả dụng
  if (isRedisEnabled && redis) {
    store = new RedisStore({
      // @ts-ignore
      sendCommand: (...args) => redis.call(...args),
      prefix: `rate-limit:${prefix}:`,
    });
  } else {
    console.warn(`[RateLimit] ⚠️ Redis không hoạt động. Hạ cấp dùng MemoryStore cho [${prefix}].`);
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Gửi thông tin giới hạn (Limit, Remaining) về client qua headers
    legacyHeaders: false,  // Tắt headers X-RateLimit-* cũ
    store,                 // Dùng Redis hoặc mặc định (MemoryStore)
    message: {
      status: 429,
      error: 'Too Many Requests',
      message: errorMessage || 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
    },
    // Không giới hạn endpoint kiểm tra sức khoẻ của Kubernetes probes
    skip: (req) => req.url === '/health'
  });
}

// Global Limiter: Áp dụng chung cho API chính
export const globalLimiter = createLimiter({
  prefix: 'global',
  windowMs: GLOBAL_WINDOW,
  max: GLOBAL_MAX,
  errorMessage: 'Hệ thống phát hiện tần suất thao tác quá nhanh. Vui lòng lướt chậm lại một chút để bảo vệ tài nguyên!'
});

// Auth Limiter: Dành riêng cho Login / Register chống Brute force
export const authLimiter = createLimiter({
  prefix: 'auth',
  windowMs: AUTH_WINDOW,
  max: AUTH_MAX,
  errorMessage: 'Bạn đã thử đăng nhập hoặc đăng ký quá nhiều lần. Vui lòng đợi 15 phút trước khi thử lại.'
});

// Media Limiter: Hạn chế tần suất upload tệp tin
export const mediaLimiter = createLimiter({
  prefix: 'media',
  windowMs: MEDIA_WINDOW,
  max: MEDIA_MAX,
  errorMessage: 'Bạn đã tải lên quá nhiều tệp tin liên tục. Vui lòng dừng lại vài phút.'
});
