import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger, traceMiddleware } from './infra/logger/logger.js';
import authRoute from './modules/auth/auth.route.js';
import postsRoute from './modules/posts/posts.route.js';
import commentsRoute from './modules/comments/comment.route.js';
import mediaRoute from './modules/media/media.route.js';
import usersRoute from './modules/users/users.route.js';
import usersPublicRoute from './modules/users/users.public.route.js';
import adminRoute from './modules/admin/admin.route.js';
import notificationsRoute from './modules/notifications/notifications.route.js';
import { verifySupabaseJWT } from './middlewares/jwt/jwt.middleware.js';
import { globalLimiter, authLimiter, mediaLimiter } from './middlewares/rateLimit/rateLimit.middleware.js';

const app = express();

// Middleware
app.use(cors());

// Global error response interceptor to prevent sensitive 500 error leaks to the client
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (res.statusCode >= 500 && process.env.NODE_ENV !== 'test') {
      const genericMsg = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
      if (body && typeof body === 'object') {
        if (body.message) body.message = genericMsg;
        if (body.error) body.error = genericMsg;
      }
    }
    return originalJson.call(this, body);
  };
  next();
});

app.use(traceMiddleware);
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url.startsWith('/api/posts/feed/seen')
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
      userAgent: req.headers['user-agent']
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.use('/api/auth', authLimiter, authRoute);
app.use('/api/media', mediaLimiter, verifySupabaseJWT, mediaRoute);

// Các API thông thường áp dụng global rate limiter
app.use('/api/admin', globalLimiter, adminRoute);
app.use('/api/users', globalLimiter, usersPublicRoute);
app.use('/api/posts', globalLimiter, verifySupabaseJWT, postsRoute);
app.use('/api/posts/:postId/comments', globalLimiter, verifySupabaseJWT, commentsRoute);
app.use('/api/users', globalLimiter, verifySupabaseJWT, usersRoute);
app.use('/api/notifications', globalLimiter, verifySupabaseJWT, notificationsRoute);

export default app;
