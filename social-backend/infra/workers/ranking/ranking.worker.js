import { createWorker } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import { rankingProcessor } from './ranking.processor.js';

export const rankingWorker = createWorker(
  QueueNames.RANKING_QUEUE,
  rankingProcessor,
  {
    concurrency: parseInt(process.env.RANKING_WORKER_CONCURRENCY || '5'),
  }
);

if (rankingWorker) {
  rankingWorker.on('completed', (job) => {
    console.log(`✓ Ranking job ${job.id} completed (Post: ${job.returnvalue?.postId}, Score: ${job.returnvalue?.score})`);
  });

  // Dead letter / failed hook
  rankingWorker.on('failed', (job, err) => {
    console.error(`✗ Ranking job ${job?.id} failed. Sent to failed set (DLQ). Error:`, err.message);
  });
}
