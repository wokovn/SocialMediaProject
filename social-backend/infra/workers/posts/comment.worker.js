import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import db from '../../../modules/db/db.js';
import { comments } from '../../../modules/db/schemas/index.js';
import redisConnection from '../../redis/redis.config.js';
import RedisKeys from '../../redis/redis.key.js';
import { commentSyncQueue } from '../../queue/comment.queue.js';

const BATCH_SIZE = parseInt(process.env.WORKER_BATCH_SIZE || '100', 10);

const commentSyncProcessor = async () => {
  const pipeline = redisConnection.pipeline();
  pipeline.lrange(RedisKeys.COMMENT_BUFFER, 0, BATCH_SIZE - 1);
  pipeline.ltrim(RedisKeys.COMMENT_BUFFER, BATCH_SIZE, -1);

  const [rangeResult] = await pipeline.exec();
  const rawData = rangeResult?.[1];

  if (!rawData || rawData.length === 0) {
    return { message: 'Nothing to sync' };
  }

  const events = rawData.map((item) => JSON.parse(item));
  const insertMap = new Map();

  events.forEach(({ commentId, userId, postId, content, parentId }) => {
    if (!commentId || !userId || !postId || !content) {
      return;
    }

    insertMap.set(commentId, {
      id: commentId,
      userId,
      postId,
      parentId: parentId || null,
      content,
    });
  });

  const toInsert = Array.from(insertMap.values());

  try {
    if (toInsert.length > 0) {
      await db.insert(comments).values(toInsert).onConflictDoNothing();
    }

    return {
      success: true,
      processed: events.length,
      inserts: toInsert.length,
    };
  } catch (error) {
    console.error('[Comment Sync] Batch synchronization failed:', error);

    if (rawData && rawData.length > 0) {
      try {
        await redisConnection.lpush(RedisKeys.COMMENT_BUFFER, ...rawData);
      } catch (redisError) {
        console.error('[Comment Sync] Critical restore error:', redisError);
      }
    }

    throw error;
  }
};

const commentWorker = new Worker(
  QueueNames.POST_COMMENT_QUEUE,
  commentSyncProcessor,
  {
    ...workerOptions,
    connection: redisConnection,
    concurrency: parseInt(process.env.POST_COMMENT_SYNC_CONCURRENCY || '1', 10),
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

commentWorker.on('ready', async () => {
  try {
    await commentSyncQueue.removeRepeatableByKey('sync-comments-batch');
    await commentSyncQueue.add('sync-comments-batch', {}, {
      repeat: {
        every: parseInt(process.env.WORKER_SYNC_INTERVAL_MS || '5000', 10),
        key: 'sync-comments-batch',
      },
      removeOnComplete: true,
      removeOnFail: true,
    });
  } catch (error) {
    console.error('Setup comment sync cron failed:', error);
  }
});

commentWorker.on('completed', (job) => {
  if (job.returnvalue?.message === 'Nothing to sync') return
  console.log(`✓ Comment sync job ${job.id} completed:`, job.returnvalue);
});

commentWorker.on('failed', (job, err) => {
  console.error(`✗ Comment sync job ${job?.id} failed:`, err.message);
});

export default commentWorker;
