import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import db from '../../modules/db/db.js';
import { comments, posts } from '../../modules/db/schemas/index.js';
import { eq } from 'drizzle-orm';

// Comment worker - handles adding comments to posts
const commentWorker = new Worker(
  'post:comment',
  async (job) => {
    const { userId, postId, content, parentId } = job.data;

    try {
      // Insert new comment
      const newComment = await db
        .insert(comments)
        .values({
          userId,
          postId,
          content,
          parentId: parentId || null,
        })
        .returning();

      // Increment comments count on post
      const post = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));

      if (post.length > 0) {
        await db
          .update(posts)
          .set({ commentsCount: (post[0].commentsCount || 0) + 1 })
          .where(eq(posts.id, postId));
      }

      // If it's a reply, increment replies count on parent comment
      if (parentId) {
        const parentComment = await db
          .select()
          .from(comments)
          .where(eq(comments.id, parentId));

        if (parentComment.length > 0) {
          await db
            .update(comments)
            .set({ repliesCount: (parentComment[0].repliesCount || 0) + 1 })
            .where(eq(comments.id, parentId));
        }
      }

      return { success: true, comment: newComment[0] };
    } catch (error) {
      console.error('Comment worker error:', error);
      throw error;
    }
  },
  workerOptions
);

commentWorker.on('completed', (job) => {
  console.log(`✓ Comment job ${job.id} completed`);
});

commentWorker.on('failed', (job, err) => {
  console.error(`✗ Comment job ${job.id} failed:`, err.message);
});

export default commentWorker;
