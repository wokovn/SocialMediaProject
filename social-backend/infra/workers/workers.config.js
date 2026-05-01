import { Queue, Worker } from 'bullmq';
import redisConnection from '../redis/redis.config.js';
import { queueOptions } from '../queue/queue.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Null-safe BullMQ factory helpers.
//
// When redisConnection is null (REDIS_ENABLED=false or connection never
// established), these return null instead of crashing at module load time.
// All callers that hold a null queue/worker simply become no-ops.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a BullMQ Queue or returns null when Redis is unavailable.
 * @param {string} name - Queue name
 * @param {object} [extraOptions] - Additional BullMQ Queue options
 */
export function createQueue(name, extraOptions = {}) {
  if (!redisConnection) return null;
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions: queueOptions,
    ...extraOptions,
  });
}

/**
 * Creates a BullMQ Worker or returns null when Redis is unavailable.
 * @param {string} name - Queue name to consume
 * @param {Function} processor - Job processor function
 * @param {object} [extraOptions] - Additional BullMQ Worker options
 */
export function createWorker(name, processor, extraOptions = {}) {
  if (!redisConnection) return null;
  return new Worker(name, processor, {
    connection: redisConnection,
    concurrency: parseInt(process.env.WORKER_DEFAULT_CONCURRENCY || '5'),
    limiter: {
      max:      parseInt(process.env.WORKER_LIMITER_MAX          || '10'),
      duration: parseInt(process.env.WORKER_LIMITER_DURATION_MS  || '1000'),
    },
    ...extraOptions,
  });
}

// Legacy export — still used by a few workers that spread workerOptions directly.
// Kept for backward compatibility; prefer createWorker() for new code.
export const workerOptions = redisConnection
  ? {
      connection: redisConnection,
      concurrency: parseInt(process.env.WORKER_DEFAULT_CONCURRENCY || '5'),
      limiter: {
        max:      parseInt(process.env.WORKER_LIMITER_MAX          || '10'),
        duration: parseInt(process.env.WORKER_LIMITER_DURATION_MS  || '1000'),
      },
    }
  : {};
