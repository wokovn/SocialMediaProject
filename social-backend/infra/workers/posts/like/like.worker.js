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
    concurrency: parseInt(process.env.POST_LIKE_SYNC_CONCURRENCY || '1', 10),
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

postlikeSyncWorker.on('ready', async () => {
  try {
    await likeSyncQueue.removeRepeatableByKey('sync-likes-batch');
    await likeSyncQueue.add('sync-likes-batch', {}, {
      repeat: {
        every: parseInt(process.env.WORKER_SYNC_INTERVAL_MS || '5000', 10),
        key: 'sync-likes-batch',
      },
      removeOnComplete: true,
      removeOnFail: true,
    });
  } catch (err) {
    console.error('Setup cron job failed:', err);
  }
});

postlikeSyncWorker.on('completed', (job) => {
  if (job.returnvalue?.message === 'Nothing to sync') return
  console.log(`✓ Like sync job ${job.id} completed:`, job.returnvalue);
});

postlikeSyncWorker.on('failed', (job, err) => {
  console.error(`✗ Like sync job ${job?.id} failed:`, err.message);
});
