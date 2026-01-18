import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import db from '../../modules/db/db.js';
import { likes, posts } from '../../modules/db/schemas/index.js';
import { eq, and } from 'drizzle-orm';

// Like worker - handles adding likes to posts
const likeWorker = new Worker(
  'post:like',
  async (job) => {
    const { userId, postId } = job.data;

    try {
      // Check if like already exists
      const existingLike = await db
        .select()
        .from(likes)
        .where(and(eq(likes.userId, userId), eq(likes.postId, postId)));

      if (existingLike.length > 0) {
        return { success: false, message: 'Already liked' };
      }

      // Insert new like
      await db.insert(likes).values({
        userId,
        postId,
      });

      // Increment likes count on post
      const post = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));

      if (post.length > 0) {
        await db
          .update(posts)
          .set({ likesCount: (post[0].likesCount || 0) + 1 })
          .where(eq(posts.id, postId));
      }

      return { success: true, userId, postId };
    } catch (error) {
      console.error('Like worker error:', error);
      throw error;
    }
  },
  workerOptions
);

likeWorker.on('completed', (job) => {
  console.log(`✓ Like job ${job.id} completed:`, job.returnvalue);
});

likeWorker.on('failed', (job, err) => {
  console.error(`✗ Like job ${job.id} failed:`, err.message);
});

export default likeWorker;
