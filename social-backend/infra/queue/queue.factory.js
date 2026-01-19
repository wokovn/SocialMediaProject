import {Queue} from 'bullmq';
import {queueOptions} from './queue.config.js';
import redisConnection from '../redis/redis.config.js';
import queueNames from './queue.names.js';

export const likeSyncQueue = new Queue(queueNames.LIKE_SYNC_QUEUE, {
  connection: redisConnection,
  ...queueOptions,
});