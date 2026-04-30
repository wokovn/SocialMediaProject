import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import db from '../../../modules/db/db.js';
import { follows, userStats } from '../../../modules/db/schemas/index.js';
import { eq, sql } from 'drizzle-orm';
import redisConnection from '../../redis/redis.config.js';
import RedisKeys from '../../redis/redis.key.js';
import { followSyncQueue } from '../../queue/follow.queue.js';

const BATCH_SIZE = parseInt(process.env.WORKER_BATCH_SIZE || '100', 10);

const toCount = (row) => {
  const parsed = Number(row?.count ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const followSyncProcessor = async () => {
  const pipeline = redisConnection.pipeline();
  pipeline.lrange(RedisKeys.FOLLOW_BUFFER, 0, BATCH_SIZE - 1);
  pipeline.ltrim(RedisKeys.FOLLOW_BUFFER, BATCH_SIZE, -1);

  const [rangeResult] = await pipeline.exec();
  const rawData = rangeResult?.[1];

  if (!rawData || rawData.length === 0) {
    return { message: 'Nothing to sync' };
  }

  const events = rawData.map((item) => JSON.parse(item));
  const syncMap = new Map();

  events.forEach(({ followerId, followingId, action }) => {
    if (!followerId || !followingId || followerId === followingId) {
      return;
    }

    syncMap.set(`${followerId}_${followingId}`, {
      followerId,
      followingId,
      action,
    });
  });

  const toInsert = [];
  const toDelete = [];
  const affectedUserIds = new Set();

  for (const item of syncMap.values()) {
    affectedUserIds.add(item.followerId);
    affectedUserIds.add(item.followingId);

    if (item.action === 'FOLLOW') {
      toInsert.push({
        followerId: item.followerId,
        followingId: item.followingId,
      });
    } else if (item.action === 'UNFOLLOW') {
      toDelete.push(item);
    }
  }

  try {
    await db.transaction(async (tx) => {
      if (toInsert.length > 0) {
        await tx.insert(follows).values(toInsert).onConflictDoNothing();
      }

      if (toDelete.length > 0) {
        const values = toDelete.map((item) => sql`(${item.followerId}, ${item.followingId})`);
        await tx
          .delete(follows)
          .where(sql`(${follows.followerId}, ${follows.followingId}) IN (${sql.join(values, sql`, `)})`);
      }

      for (const userId of affectedUserIds) {
        const [followersResult, followingResult] = await Promise.all([
          tx
            .select({ count: sql`count(*)::int` })
            .from(follows)
            .where(eq(follows.followingId, userId))
            .limit(1),
          tx
            .select({ count: sql`count(*)::int` })
            .from(follows)
            .where(eq(follows.followerId, userId))
            .limit(1),
        ]);

        const followersCount = toCount(followersResult[0]);
        const followingCount = toCount(followingResult[0]);

        await tx
          .insert(userStats)
          .values({
            userId,
            followersCount,
            followingCount,
            postsCount: 0,
          })
          .onConflictDoUpdate({
            target: userStats.userId,
            set: {
              followersCount,
              followingCount,
              updatedAt: new Date(),
            },
          });
      }
    });

    return {
      success: true,
      processed: events.length,
      inserts: toInsert.length,
      deletes: toDelete.length,
    };
  } catch (error) {
    console.error('[Follow Sync] Batch synchronization failed:', error);

    if (rawData && rawData.length > 0) {
      try {
        await redisConnection.lpush(RedisKeys.FOLLOW_BUFFER, ...rawData);
      } catch (redisError) {
        console.error('[Follow Sync] Critical restore error:', redisError);
      }
    }

    throw error;
  }
};

const followWorker = new Worker(
  QueueNames.USER_FOLLOW_QUEUE,
  followSyncProcessor,
  {
    ...workerOptions,
    connection: redisConnection,
    concurrency: parseInt(process.env.USER_FOLLOW_SYNC_CONCURRENCY || '1', 10),
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

followWorker.on('ready', async () => {
  try {
    await followSyncQueue.removeRepeatableByKey('sync-follows-batch');
    await followSyncQueue.add('sync-follows-batch', {}, {
      repeat: {
        every: parseInt(process.env.WORKER_SYNC_INTERVAL_MS || '5000', 10),
        key: 'sync-follows-batch',
      },
      removeOnComplete: true,
      removeOnFail: true,
    });
  } catch (error) {
    console.error('Setup follow sync cron failed:', error);
  }
});

followWorker.on('completed', (job) => {
  if (job.returnvalue?.message === 'Nothing to sync') return
  console.log(`✓ Follow sync job ${job.id} completed:`, job.returnvalue);
});

followWorker.on('failed', (job, err) => {
  console.error(`✗ Follow sync job ${job?.id} failed:`, err.message);
});

export default followWorker;
