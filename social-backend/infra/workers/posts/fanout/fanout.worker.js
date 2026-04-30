import { Worker } from 'bullmq';
import { workerOptions } from '../../workers.config.js';
import redisConnection from '../../../redis/redis.config.js';
import QueueNames from '../../../queue/queue.names.js';
import { fanoutProcessor } from './fanout.processor.js';

export const fanoutWorker = new Worker(
  QueueNames.FANOUT_QUEUE,
  fanoutProcessor,
  {
    ...workerOptions,
    connection: redisConnection,
    concurrency: 5,
  }
);

fanoutWorker.on('completed', (job) => {
  console.log(`✓ Fanout job ${job.id} completed (Post: ${job.returnvalue?.postId}, isIdol: ${job.returnvalue?.isIdol})`);
});

fanoutWorker.on('failed', (job, err) => {
  console.error(`✗ Fanout job ${job?.id} failed:`, err.message);
});
