import { workerOptions } from "./workers.config.js";
import { Worker, Queue } from "bullmq";
import redisConnection from "../../infra/redis/redis.config.js";
import QueueNames from "../../infra/queue/queue.names.js";
import { postLikeSyncProcessor } from "./posts/like/like.processor.js";

// 1. Worker: Responsible for processing tasks
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
    }
  }
);

// 2. Queue: Responsible for managing jobs (Add/Remove Job)
// Temporary instance of Queue for job control
const likeSyncQueue = new Queue(QueueNames.LIKE_SYNC_QUEUE, {
    connection: redisConnection
});

// 3. Setup Cron Job
postlikeSyncWorker.on('ready', async () => {
    try {
        console.log('Worker is ready! Setting up cron job...');
        
        // Use QUEUE to remove old jobs (if any)
        // Note: removeRepeatableByKey requires the exact generated key,
        // but the safest way is to use removeRepeatable with the same configuration.
        // Alternatively, you can ignore it, as the newer version of bullmq automatically handles key overrides.
        
        // Proper way to remove old repeatable jobs based on a custom key:
        await likeSyncQueue.removeRepeatableByKey('sync-likes-batch');

        // Use QUEUE to add new jobs
        await likeSyncQueue.add('sync-likes-batch', {}, {
            repeat: {
                every: 5000, // Runs every 5 seconds
                key: 'sync-likes-batch' // Identifier key for easier removal later
            },
            removeOnComplete: true,
            removeOnFail: true,
        });
        
        console.log('Cron job setup done!');
    } catch (err) {
        console.error('Setup cron job failed:', err);
    }
});