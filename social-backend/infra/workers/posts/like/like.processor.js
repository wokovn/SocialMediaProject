import db from '../../../../modules/db/db.js';
import { posts, likes } from '../../../../modules/db/schemas/index.js';
import { eq, inArray, sql } from 'drizzle-orm';
import redisConnection from "../../../redis/redis.config.js";
import RedisKeys from "../../../redis/redis.key.js";

const BATCH_SIZE = 100; // Process 100 likes per batch

export const postLikeSyncProcessor = async (job) => {
  // Step 1: Retrieve data from Redis buffer
  // Use pipeline to atomically fetch data and trim the list
  const pipeline = redisConnection.pipeline();
  pipeline.lrange(RedisKeys.LIKE_BUFFER, 0, BATCH_SIZE - 1);
  pipeline.ltrim(RedisKeys.LIKE_BUFFER, BATCH_SIZE, -1);
  
  const [rangeResult, trimResult] = await pipeline.exec();
  
  // Parse JSON string data to objects
  const rawData = rangeResult[1]; 
  if (!rawData || rawData.length === 0) {
    return { message: 'Nothing to sync' };
  }

  const events = rawData.map(item => JSON.parse(item));

  // Step 2: Classify actions into Insert or Delete operations
  // Use Map to filter duplicates (e.g., when user likes then unlikes within the same batch)
  const syncMap = new Map(); // Key: `${userId}_${postId}` -> Value: Final action

  events.forEach(({ userId, postId, action }) => {
    // Skip invalid events that are missing userId or postId
    if (!userId || !postId) {
      console.log('[Like Sync] Skipping invalid event:', { userId, postId, action });
      return;
    }
    syncMap.set(`${userId}_${postId}`, { userId, postId, action });
  });

  const toInsert = [];
  const toDelete = [];
  const postIdsToUpdateCount = new Set(); // Store post IDs for count updates

  for (const item of syncMap.values()) {
    postIdsToUpdateCount.add(item.postId);
    if (item.action === 'LIKE') {
      toInsert.push({ 
        userId: item.userId, 
        postId: item.postId, 
        commentId: null,
        createdAt: new Date() 
      });
    } else if (item.action === 'UNLIKE') {
      toDelete.push(item);
    }
  }



  try {
    await db.transaction(async (tx) => {
      // Step 3: Bulk insert like records
      if (toInsert.length > 0) {
        await tx
          .insert(likes)
          .values(toInsert)
          .onConflictDoNothing(); // Skip if record already exists to avoid errors
      }

     // Step 4: Bulk delete unlike records (optimized)
      if (toDelete.length > 0) {
         // Transform array of objects into SQL tuples: (userId, postId)
         const values = toDelete.map(d => sql`(${d.userId}, ${d.postId})`);

         // Execute bulk delete: WHERE (user_id, post_id) IN ((u1, p1), (u2, p2), ...)
         await tx.delete(likes)
           .where(
             sql`(${likes.userId}, ${likes.postId}) IN (${sql.join(values, sql`, `)})`
           );
      }

      // Step 5: Update like counts for posts (recommended for data consistency)
      // Sync accurate count from Redis cache to database
      for (const postId of postIdsToUpdateCount) {
         // Retrieve real-time count from Redis
         const realCount = await redisConnection.scard(`post:${postId}:likes`); 
         await tx.update(posts)
           .set({ likesCount: realCount })
           .where(eq(posts.id, postId));
      }
    });

    return { 
      success: true, 
      processed: events.length, 
      inserts: toInsert.length, 
      deletes: toDelete.length 
    };

  } catch (error) {
    console.error('[Like Sync] Batch synchronization failed:', error);

    // Data recovery logic
    // If data was retrieved but not yet saved to database, push it back to the queue
    if (rawData && rawData.length > 0) {
        try {
            console.log(`[Like Sync] Restoring ${rawData.length} items to Redis buffer...`);
            
            // Use LPUSH to push items back to the head of the list for priority processing
            // Spread operator to push entire array at once
            await redisConnection.lpush(RedisKeys.LIKE_BUFFER, ...rawData);
            
            console.log('[Like Sync] Data successfully restored to buffer');
        } catch (redisError) {
            // Critical failure: Both database and Redis operations failed
            console.error('[Like Sync] Critical error: Failed to restore data to Redis:', redisError);
            // Consider writing to local file system for data recovery
        }
    }

    // Re-throw error so BullMQ marks the job as failed for monitoring
    throw error;
  }
};