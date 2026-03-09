import { Worker } from 'bullmq';
import { workerOptions } from '../../workers.config.js';
import redisConnection from '../../../redis/redis.config.js';
import QueueNames from '../../../queue/queue.names.js';
import { postLikeSyncProcessor } from './like.processor.js';
import { likeSyncQueue } from '../../../queue/like.queue.js';

export const postlikeSyncWorker = new Worker(
  QueueNames.LIKE_SYNC_QUEUE,
  postLikeSyncProcessor,
  {
    ...workerOptions,
    connection: redisConnection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

postlikeSyncWorker.on('ready', async () => {
  try {
    console.log('Worker is ready! Setting up cron job...');
    await likeSyncQueue.removeRepeatableByKey('sync-likes-batch');
    await likeSyncQueue.add('sync-likes-batch', {}, {
      repeat: {
        every: 5000,
        key: 'sync-likes-batch',
      },
      removeOnComplete: true,
      removeOnFail: true,
    });
    console.log('Cron job setup done!');
  } catch (err) {
    console.error('Setup cron job failed:', err);
  }
});
