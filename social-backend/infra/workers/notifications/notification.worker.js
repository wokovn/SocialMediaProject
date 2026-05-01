import { createWorker } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import { notificationProcessor } from './notification.processor.js';

export const notificationWorker = createWorker(
  QueueNames.NOTIFICATION_QUEUE,
  notificationProcessor,
  {
    concurrency: parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY || '5', 10),
  }
);

if (notificationWorker) {
  notificationWorker.on('completed', (job) => {
    console.log(`✓ Notification job ${job.id} completed (Realtime: ${job.returnvalue?.deliveredRealtime})`);
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`✗ Notification job ${job?.id} failed:`, err.message);
  });
}
