import { Queue } from 'bullmq';
import { queueOptions } from './queue.config.js';
import redisConnection from '../redis/redis.config.js';
import QueueNames from './queue.names.js';

export const fanoutQueue = new Queue(QueueNames.FANOUT_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: queueOptions,
});
