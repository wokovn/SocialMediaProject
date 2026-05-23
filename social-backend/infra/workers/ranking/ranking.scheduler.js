/**
 * PLAN: Periodic Decay Refresh Scheduler
 *
 * Problem this solves:
 *   The ranking score is computed at interaction time. A viral post from 6 hours ago
 *   has a higher score than it "deserves" now (12 hours later) because time has passed
 *   but the score in Redis hasn't been updated.
 *
 * Solution (Lazy Decay):
 *   Every hour, fetch the top N posts from the hot pool and enqueue a DECAY_UPDATE job.
 *   The worker re-computes score with the current T (age) — no new interactions counted.
 *   This keeps the sorted set ordering accurate over time without running on every request.
 *
 * Trade-off:
 *   Scores may be up to 1 hour stale between decay refreshes.
 *   This is acceptable — social feeds don't need millisecond accuracy.
 */

import redisClient, { isRedisEnabled } from '../../redis/redis.config.js';
import { addDecayUpdateJob, rankingQueue } from '../../queue/ranking.queue.js';
import { HOT_ZSET } from './ranking.processor.js';

// How many top posts to refresh per cycle
const DECAY_REFRESH_TOP_N = parseInt(process.env.RANKING_DECAY_REFRESH_N || '200');

// Delay between individual job enqueues to avoid queue spike (ms)
const ENQUEUE_DELAY_MS = parseInt(process.env.RANKING_DECAY_ENQUEUE_DELAY_MS || '50');

// Default interval for the decay scheduler (ms)
const DEFAULT_DECAY_INTERVAL = parseInt(process.env.RANKING_DECAY_INTERVAL_MS || '3600000');

/**
 * Enqueues DECAY_UPDATE jobs for the top N posts in the hot pool.
 * Called by a setInterval in server.js or a cron runner.
 */
export const runDecayRefresh = async () => {
    if (!isRedisEnabled) return;
    try {
        // Fetch top N post IDs from the hot sorted set (highest score first)
        const topPostIds = await redisClient.zrevrange(HOT_ZSET, 0, DECAY_REFRESH_TOP_N - 1);

        if (!topPostIds.length) {
            console.log('[DecayScheduler] No posts in hot pool, skipping.');
            return;
        }

        console.log(`[DecayScheduler] Refreshing decay scores for ${topPostIds.length} hot posts...`);

        for (const postId of topPostIds) {
            await addDecayUpdateJob(postId);
            // Small delay to avoid flooding the queue all at once
            await new Promise(resolve => setTimeout(resolve, ENQUEUE_DELAY_MS));
        }

        console.log(`[DecayScheduler] Enqueued ${topPostIds.length} decay refresh jobs.`);
    } catch (err) {
        console.error('[DecayScheduler] Failed to run decay refresh:', err.message);
    }
};

/**
 * Starts the decay scheduler via BullMQ Repeatable Jobs.
 * @param {number} intervalMs - How often to run
 */
export const setupRepeatableDecayScheduler = async (intervalMs = DEFAULT_DECAY_INTERVAL) => {
    if (!isRedisEnabled || !rankingQueue) {
        console.warn('[DecayScheduler] Redis disabled — scheduler will not run.');
        return null;
    }
    
    try {
        // Remove existing repeatable jobs to prevent duplicates if interval changes
        const repeatableJobs = await rankingQueue.getRepeatableJobs();
        for (const job of repeatableJobs) {
            if (job.name === 'DECAY_SCHEDULER_JOB') {
                await rankingQueue.removeRepeatableByKey(job.key);
            }
        }

        // Add new repeatable job
        await rankingQueue.add('DECAY_SCHEDULER_JOB', {}, {
            repeat: {
                every: intervalMs
            }
        });
        console.log(`[DecayScheduler] Setup repeatable job — refreshing top ${DECAY_REFRESH_TOP_N} posts every ${intervalMs / 60000} minutes.`);
    } catch (err) {
        console.error('[DecayScheduler] Failed to setup repeatable job:', err.message);
    }
};
