import { createWorker } from '../../workers.config.js';
import QueueNames from '../../../queue/queue.names.js';
import { fanoutProcessor } from './fanout.processor.js';

export const fanoutWorker = createWorker(
  QueueNames.FANOUT_QUEUE,
  fanoutProcessor,
  {
    concurrency: parseInt(process.env.POST_FANOUT_CONCURRENCY || '5', 10),
  }
);

if (fanoutWorker) {
  fanoutWorker.on('completed', (job) => {
    console.log(`✓ Fanout job ${job.id} completed (Post: ${job.returnvalue?.postId}, isIdol: ${job.returnvalue?.isIdol})`);
  });

  fanoutWorker.on('failed', (job, err) => {
    console.error(`✗ Fanout job ${job?.id} failed:`, err.message);
  });
}
