import redisConnection from '../redis/redis.config.js';
// Worker options
export const workerOptions = {
  connection: redisConnection,
  concurrency: parseInt(process.env.WORKER_DEFAULT_CONCURRENCY || '5'),
  limiter: {
    max:      parseInt(process.env.WORKER_LIMITER_MAX         || '10'),
    duration: parseInt(process.env.WORKER_LIMITER_DURATION_MS || '1000'),
  },
};
