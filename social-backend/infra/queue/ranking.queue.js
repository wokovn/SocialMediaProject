import { Queue } from 'bullmq';
import { queueOptions } from './queue.config.js';
import redisConnection from '../redis/redis.config.js';
import QueueNames from './queue.names.js';
import RedisKeys from '../redis/redis.key.js';

// When Redis is disabled, redisConnection is null — BullMQ Queue will be inert.
export const rankingQueue = redisConnection
  ? new Queue(QueueNames.RANKING_QUEUE, {
      connection: redisConnection,
      defaultJobOptions: queueOptions,
    })
  : null;

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const THROTTLE_SECONDS    = parseInt(process.env.RANKING_THROTTLE_SECONDS || '300'); // 5 phút
const THRESHOLD_PERCENT   = parseFloat(process.env.RANKING_THRESHOLD_PERCENT || '5');
const MIN_INTERACTIONS    = parseInt(process.env.RANKING_THRESHOLD_MIN_BASE || '20');
// Throttle & Threshold phối hợp 2 tầng:
//   Threshold (5%) → lọc tinh: bỏ qua các thay đổi không đáng kể
//   Throttle (5p)  → lọc thô: chặn burst sau khi threshold đã pass
// Posts mới (< MIN_INTERACTIONS) luôn bypass threshold, chỉ bị throttle

// Absolute weight per interaction type (used for threshold check in queue layer)
const INTERACTION_WEIGHTS = {
  'CLICK':   1,
  'LIKE':    2,
  'UNLIKE':  2, // dùng abs value để tính % thay đổi
  'COMMENT': 3,
  'SHARE':   4,
};

/**
 * Throttle (5 phút) + Threshold (5%) — 2 tầng lọc:
 *
 * Tầng 1 — Threshold (5%):
 *   Kiểm tra trước: interaction mới có thay đổi ≥5% tổng score không?
 *   Nếu không đáng kể → bỏ qua, release lock để interaction tiếp theo re-check.
 *   Áp dụng khi post đã có ≥ MIN_INTERACTIONS (tránh block posts mới).
 *
 * Tầng 2 — Throttle (5 phút):
 *   Sau khi threshold pass, giới hạn tối đa 1 job/5 phút/post.
 *   Đủ dài vì: posts viral sẽ pass threshold nhanh (mỗi 100 like = pass);
 *   posts bình thường sẽ được decay scheduler refresh mỗi giờ.
 *
 * Counter (post:interactions:total) luôn được cập nhật trong processor
 * qua Lua atomic → không mất interaction dù job bị throttle hay skip.
 */
export const addRankingJobWithThrottle = async (postId, interactionType) => {
    if (!redisConnection || !rankingQueue) return { added: false, reason: 'redis_disabled' };
    try {
        // ── STEP 1: Throttle check ──────────────────────────────────────────────
        const lockKey = RedisKeys.rankingLock(postId);
        const acquired = await redisConnection.set(lockKey, '1', 'NX', 'EX', THROTTLE_SECONDS);

        if (!acquired) {
            return { added: false, reason: 'throttled' };
        }

        // ── STEP 2: Threshold check (5%) ────────────────────────────────────────
        const interactionKey = interactionType.toUpperCase();
        const weight = INTERACTION_WEIGHTS[interactionKey] ?? 1;

        // [BUG FIX] Key phải khớp với format trong ranking.processor.js: post:{postId}:interactions:total
        const currentRaw = await redisConnection.get(RedisKeys.postInteractionsTotal(postId));
        const currentInteractions = currentRaw !== null ? Number(currentRaw) : 0;

        if (currentInteractions >= MIN_INTERACTIONS) {
            const changePercent = (weight / currentInteractions) * 100;
            if (changePercent < THRESHOLD_PERCENT) {
                // Interaction is too small relative to post's existing score base.
                // Release the throttle lock so next interaction can re-check.
                await redisConnection.del(lockKey);
                return { added: false, reason: `below_threshold (${changePercent.toFixed(2)}% < ${THRESHOLD_PERCENT}%)` };
            }
        }

        // ── STEP 3: Add job ─────────────────────────────────────────────────────
        await rankingQueue.add('rank', { postId, interactionType }, {
            jobId: `rank:${postId}:${Date.now()}`,
        });

        return { added: true };
    } catch (err) {
        console.warn('[RankingQueue] Redis unavailable, skipping ranking job:', err.message);
        return { added: false, reason: 'redis_error' };
    }
};

/**
 * Force a ranking recalculation without adding interaction weight.
 * Used by the hourly decay scheduler to refresh scores with updated T (age).
 * Not throttled — scheduler controls its own frequency.
 */
export const addDecayUpdateJob = async (postId) => {
    if (!redisConnection || !rankingQueue) return;
    try {
        await rankingQueue.add('rank', { postId, interactionType: 'DECAY_UPDATE' }, {
            jobId: `decay:${postId}:${Date.now()}`,
            priority: 10, // lower priority than real interactions (1=highest, 10=low)
        });
    } catch (err) {
        console.warn('[RankingQueue] Redis unavailable, skipping decay job:', err.message);
    }
};
