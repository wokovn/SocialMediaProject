import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import db from '../../modules/db/db.js';
import { likes, posts } from '../../modules/db/schemas/index.js';
import { eq, and } from 'drizzle-orm';

// Unlike worker - handles removing likes from posts
const unlikeWorker = new Worker(
  'post:unlike',
  async (job) => {
    const { userId, postId } = job.data;

    try {
      // Delete the like
      const deleted = await db
        .delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
        .returning();

      if (deleted.length === 0) {
        return { success: false, message: 'Like not found' };
      }

      // Decrement likes count on post
      const post = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));

      if (post.length > 0 && post[0].likesCount > 0) {
        await db
          .update(posts)
          .set({ likesCount: post[0].likesCount - 1 })
          .where(eq(posts.id, postId));
      }

      return { success: true, userId, postId };
    } catch (error) {
      console.error('Unlike worker error:', error);
      throw error;
    }
  },
  workerOptions
);

unlikeWorker.on('completed', (job) => {
  console.log(`✓ Unlike job ${job.id} completed:`, job.returnvalue);
});

unlikeWorker.on('failed', (job, err) => {
  console.error(`✗ Unlike job ${job.id} failed:`, err.message);
});

export default unlikeWorker;
