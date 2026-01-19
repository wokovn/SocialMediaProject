import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import db from '../../../modules/db/db.js';
import { follows, userStats } from '../../../modules/db/schemas/index.js';
import { eq, and } from 'drizzle-orm';

// Follow worker - handles user follow actions
const followWorker = new Worker(
  'user:follow',
  async (job) => {
    const { followerId, followingId } = job.data;

    try {
      // Validate not following self
      if (followerId === followingId) {
        return { success: false, message: 'Cannot follow yourself' };
      }

      // Check if already following
      const existingFollow = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));

      if (existingFollow.length > 0) {
        return { success: false, message: 'Already following' };
      }

      // Insert follow relationship
      await db.insert(follows).values({
        followerId,
        followingId,
      });

      // Update follower's following count
      const followerStats = await db
        .select()
        .from(userStats)
        .where(eq(userStats.userId, followerId));

      if (followerStats.length > 0) {
        await db
          .update(userStats)
          .set({ followingCount: (followerStats[0].followingCount || 0) + 1 })
          .where(eq(userStats.userId, followerId));
      } else {
        await db.insert(userStats).values({
          userId: followerId,
          followingCount: 1,
          followersCount: 0,
          postsCount: 0,
        });
      }

      // Update following's followers count
      const followingStats = await db
        .select()
        .from(userStats)
        .where(eq(userStats.userId, followingId));

      if (followingStats.length > 0) {
        await db
          .update(userStats)
          .set({ followersCount: (followingStats[0].followersCount || 0) + 1 })
          .where(eq(userStats.userId, followingId));
      } else {
        await db.insert(userStats).values({
          userId: followingId,
          followersCount: 1,
          followingCount: 0,
          postsCount: 0,
        });
      }

      return { success: true, followerId, followingId };
    } catch (error) {
      console.error('Follow worker error:', error);
      throw error;
    }
  },
  workerOptions
);

followWorker.on('completed', (job) => {
  console.log(`✓ Follow job ${job.id} completed:`, job.returnvalue);
});

followWorker.on('failed', (job, err) => {
  console.error(`✗ Follow job ${job.id} failed:`, err.message);
});

export default followWorker;
