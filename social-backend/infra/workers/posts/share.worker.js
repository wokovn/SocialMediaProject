import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import db from '../../../modules/db/db.js';
import { posts } from '../../../modules/db/schemas/index.js';
import { eq, sql } from 'drizzle-orm';
import redisConnection from '../../redis/redis.config.js';
import RedisKeys from '../../redis/redis.key.js';
import { shareSyncQueue } from '../../queue/share.queue.js';

const BATCH_SIZE = parseInt(process.env.WORKER_BATCH_SIZE || '100', 10);

const shareSyncProcessor = async () => {
  const pipeline = redisConnection.pipeline();
  pipeline.lrange(RedisKeys.SHARE_BUFFER, 0, BATCH_SIZE - 1);
  pipeline.ltrim(RedisKeys.SHARE_BUFFER, BATCH_SIZE, -1);

  const [rangeResult] = await pipeline.exec();
  const rawData = rangeResult?.[1];

  if (!rawData || rawData.length === 0) {
    return { message: 'Nothing to sync' };
  }

  const events = rawData.map((item) => JSON.parse(item));
  const shareCountByPostId = new Map();

  events.forEach(({ postId }) => {
    if (!postId) {
      return;
    }

    shareCountByPostId.set(postId, (shareCountByPostId.get(postId) || 0) + 1);
  });

  try {
    await db.transaction(async (tx) => {
      for (const [postId, incrementBy] of shareCountByPostId.entries()) {
        await tx
          .update(posts)
          .set({ sharesCount: sql`${posts.sharesCount} + ${incrementBy}` })
          .where(eq(posts.id, postId));
      }
    });

    return {
      success: true,
      processed: events.length,
      updatedPosts: shareCountByPostId.size,
    };
  } catch (error) {
    console.error('[Share Sync] Batch synchronization failed:', error);

    if (rawData && rawData.length > 0) {
      try {
        await redisConnection.lpush(RedisKeys.SHARE_BUFFER, ...rawData);
      } catch (redisError) {
        console.error('[Share Sync] Critical restore error:', redisError);
      }
    }

    throw error;
  }
};

const shareWorker = new Worker(
  QueueNames.POST_SHARE_QUEUE,
  shareSyncProcessor,
  {
    ...workerOptions,
    connection: redisConnection,
    concurrency: parseInt(process.env.POST_SHARE_SYNC_CONCURRENCY || '1', 10),
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

shareWorker.on('ready', async () => {
  try {
    await shareSyncQueue.removeRepeatableByKey('sync-shares-batch');
    await shareSyncQueue.add('sync-shares-batch', {}, {
      repeat: {
        every: parseInt(process.env.WORKER_SYNC_INTERVAL_MS || '5000', 10),
        key: 'sync-shares-batch',
      },
      removeOnComplete: true,
      removeOnFail: true,
    });
  } catch (error) {
    console.error('Setup share sync cron failed:', error);
  }
});

shareWorker.on('completed', (job) => {
  if (job.returnvalue?.message === 'Nothing to sync') return
  console.log(`✓ Share sync job ${job.id} completed:`, job.returnvalue);
});

shareWorker.on('failed', (job, err) => {
  console.error(`✗ Share sync job ${job?.id} failed:`, err.message);
});

export default shareWorker;
