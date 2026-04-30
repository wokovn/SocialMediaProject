import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import redisConnection from '../../redis/redis.config.js';
import QueueNames from '../../queue/queue.names.js';
import { rankingProcessor } from './ranking.processor.js';

export const rankingWorker = new Worker(
  QueueNames.RANKING_QUEUE,
  rankingProcessor,
  {
    ...workerOptions,
    connection: redisConnection,
    concurrency: parseInt(process.env.RANKING_WORKER_CONCURRENCY || '5'),
  }
);

rankingWorker.on('completed', (job) => {
  console.log(`✓ Ranking job ${job.id} completed (Post: ${job.returnvalue?.postId}, Score: ${job.returnvalue?.score})`);
});

// Dead letter / failed hook
rankingWorker.on('failed', (job, err) => {
  console.error(`✗ Ranking job ${job?.id} failed. Sent to failed set (DLQ). Error:`, err.message);
});
