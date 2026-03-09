import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import db from '../../../modules/db/db.js';
import { posts } from '../../../modules/db/schemas/index.js';
import { eq } from 'drizzle-orm';

// Share worker - handles incrementing share count
const shareWorker = new Worker(
  QueueNames.POST_SHARE_QUEUE,
  async (job) => {
    const { userId, postId } = job.data;

    try {
      // Increment shares count on post
      const post = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));

      if (post.length === 0) {
        return { success: false, message: 'Post not found' };
      }

      await db
        .update(posts)
        .set({ sharesCount: (post[0].sharesCount || 0) + 1 })
        .where(eq(posts.id, postId));

      return { success: true, userId, postId };
    } catch (error) {
      console.error('Share worker error:', error);
      throw error;
    }
  },
  workerOptions
);

shareWorker.on('completed', (job) => {
  console.log(`✓ Share job ${job.id} completed:`, job.returnvalue);
});

shareWorker.on('failed', (job, err) => {
  console.error(`✗ Share job ${job.id} failed:`, err.message);
});

export default shareWorker;
