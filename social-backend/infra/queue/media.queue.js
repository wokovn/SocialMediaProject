import { Queue } from 'bullmq';
import { queueOptions } from './queue.config.js';
import redisConnection from '../redis/redis.config.js';
import QueueNames from './queue.names.js';

export const mediaResizeQueue = new Queue(QueueNames.MEDIA_RESIZE_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: queueOptions,
});

export const mediaCleanupQueue = new Queue(QueueNames.MEDIA_CLEANUP_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: queueOptions,
});