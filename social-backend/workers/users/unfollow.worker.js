import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import db from '../../modules/db/db.js';
import { follows, userStats } from '../../modules/db/schemas/index.js';
import { eq, and } from 'drizzle-orm';

// Unfollow worker - handles user unfollow actions
const unfollowWorker = new Worker(
  'user:unfollow',
  async (job) => {
    const { followerId, followingId } = job.data;

    try {
      // Delete follow relationship
      const deleted = await db
        .delete(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
        .returning();

      if (deleted.length === 0) {
        return { success: false, message: 'Follow relationship not found' };
      }

      // Update follower's following count
      const followerStats = await db
        .select()
        .from(userStats)
        .where(eq(userStats.userId, followerId));

      if (followerStats.length > 0 && followerStats[0].followingCount > 0) {
        await db
          .update(userStats)
          .set({ followingCount: followerStats[0].followingCount - 1 })
          .where(eq(userStats.userId, followerId));
      }

      // Update following's followers count
      const followingStats = await db
        .select()
        .from(userStats)
        .where(eq(userStats.userId, followingId));

      if (followingStats.length > 0 && followingStats[0].followersCount > 0) {
        await db
          .update(userStats)
          .set({ followersCount: followingStats[0].followersCount - 1 })
          .where(eq(userStats.userId, followingId));
      }

      return { success: true, followerId, followingId };
    } catch (error) {
      console.error('Unfollow worker error:', error);
      throw error;
    }
  },
  workerOptions
);

unfollowWorker.on('completed', (job) => {
  console.log(`✓ Unfollow job ${job.id} completed:`, job.returnvalue);
});

unfollowWorker.on('failed', (job, err) => {
  console.error(`✗ Unfollow job ${job.id} failed:`, err.message);
});

export default unfollowWorker;
