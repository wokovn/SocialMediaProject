import redisConnection from '../redis/redis.config.js';
// Worker options
export const workerOptions = {
  connection: redisConnection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
};
