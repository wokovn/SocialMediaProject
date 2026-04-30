import { Queue } from 'bullmq';
import { queueOptions } from './queue.config.js';
import redisConnection from '../redis/redis.config.js';
import QueueNames from './queue.names.js';

export const rankingQueue = new Queue(QueueNames.RANKING_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: queueOptions, // Sử dụng config retry/backoff và failed keep count đã có
});
