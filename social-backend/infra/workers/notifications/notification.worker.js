import { createWorker } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import { notificationProcessor } from './notification.processor.js';
import { notificationQueue } from '../../queue/notification.queue.js';

export const notificationWorker = createWorker(
  QueueNames.NOTIFICATION_QUEUE,
  notificationProcessor,
  {
    concurrency: parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY || '5', 10),
  }
);

if (notificationWorker) {
  console.log('[NotificationWorker] Worker initialized successfully.');

  // Setup repeatable batch flushing job every 2 seconds if queue is active
  if (notificationQueue) {
    // Remove existing repeatable job to prevent duplicates on restart
    notificationQueue.getRepeatableJobs().then((jobs) => {
      jobs.forEach(async (job) => {
        if (job.name === 'FLUSH_NOTIFICATIONS') {
          await notificationQueue.removeRepeatableByKey(job.key);
        }
      });
    }).catch(err => console.error('[NotificationWorker] Error cleaning up repeatable jobs:', err));

    // Register repeatable job
    notificationQueue.add('FLUSH_NOTIFICATIONS', {}, {
      repeat: {
        every: 2000 // Run batch flushing every 2 seconds
      },
      removeOnComplete: true,
      removeOnFail: true,
    }).then(() => {
      console.log('[NotificationWorker] Scheduled repeatable batch flush job (every 2 seconds).');
    }).catch(err => {
      console.error('[NotificationWorker] Failed to schedule repeatable batch flush job:', err);
    });
  }

  notificationWorker.on('completed', (job) => {
    if (job.name === 'FLUSH_NOTIFICATIONS') {
      if (job.returnvalue?.processed > 0) {
        console.log(`[NotificationWorker] Batch completed: Processed ${job.returnvalue.processed} notifications in a single transaction.`);
      }
    } else {
      console.log(`✓ Notification job ${job.id} completed (Realtime: ${job.returnvalue?.deliveredRealtime})`);
    }
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`✗ Notification job ${job?.id} failed:`, err.message);
  });
}

