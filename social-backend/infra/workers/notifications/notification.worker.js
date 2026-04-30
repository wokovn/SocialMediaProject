import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import redisConnection from '../../redis/redis.config.js';
import QueueNames from '../../queue/queue.names.js';
import { notificationProcessor } from './notification.processor.js';

export const notificationWorker = new Worker(
  QueueNames.NOTIFICATION_QUEUE,
  notificationProcessor,
  {
    ...workerOptions,
    connection: redisConnection,
    concurrency: parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY || '5', 10),
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`✓ Notification job ${job.id} completed (Realtime: ${job.returnvalue?.deliveredRealtime})`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`✗ Notification job ${job?.id} failed:`, err.message);
});
