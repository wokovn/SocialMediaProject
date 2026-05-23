import redisClient from '../../redis/redis.config.js';
import { supabase as supabaseService } from '../../../modules/auth/supabase.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION (overridable via env)
// ─────────────────────────────────────────────────────────────────────────────
const DECAY_FACTOR     = parseFloat(process.env.RANKING_TIME_DECAY_FACTOR    || '1.8');
const CMS_BONUS        = parseFloat(process.env.RANKING_CMS_BONUS_WEIGHT      || '10');
const ACTIVE_HOURS     = parseInt(process.env.RANKING_ACTIVE_HOURS            || '168');     // Hot pool: 7 days
const MAX_HOT_SIZE     = parseInt(process.env.RANKING_MAX_HOT_SIZE            || '1000');    // Sliding window cap
const MAX_COLD_SIZE    = parseInt(process.env.RANKING_MAX_COLD_SIZE           || '5000');    // Cold archive cap
const INTERACTIONS_TTL = parseInt(process.env.RANKING_INTERACTIONS_TTL        || '5184000'); // 60 days
const CREATED_AT_TTL   = parseInt(process.env.RANKING_CREATED_AT_TTL          || '1209600'); // 14 days

// ─────────────────────────────────────────────────────────────────────────────
// PLAN: Active / Cold partition keys
// ─────────────────────────────────────────────────────────────────────────────
export const HOT_ZSET  = 'global_trending_feed'; // top posts ≤ ACTIVE_HOURS old
export const COLD_ZSET = 'global_cold_feed';     // archived posts > ACTIVE_HOURS

// ─────────────────────────────────────────────────────────────────────────────
// SCORE TIERS — benchmarks cho admin dashboard
//
// Formula: score = (weightedInteractions + CMS_BONUS) / (hoursAge + 2)^1.8
//
// Ví dụ thực tế:
//   Post 0h tuổi, 50 likes (I=100):  (100+10) / (0+2)^1.8 ≈ 31.6  → 🔥 Viral
//   Post 1h tuổi, 30 likes (I=60):   (60+10)  / (3)^1.8   ≈ 9.7   → 🟠 Hot
//   Post 6h tuổi, 50 likes (I=100):  (100+10) / (8)^1.8   ≈ 2.6   → 🟡 Warm
//   Post 24h tuổi, 50 likes (I=100): (100+10) / (26)^1.8  ≈ 0.31  → 🟢 Normal
//   Post 72h tuổi, 30 likes (I=60):  (60+10)  / (74)^1.8  ≈ 0.03  → ⚫ Cold
// ─────────────────────────────────────────────────────────────────────────────
export const SCORE_TIERS = [
  { label: '🔥 Viral',  min: 15,   max: Infinity, description: 'Bài cực nóng, viral trong 1-2 giờ đầu' },
  { label: '🟠 Hot',    min: 5,    max: 15,       description: 'Trending, tương tác mạnh và còn mới' },
  { label: '🟡 Warm',   min: 1,    max: 5,        description: 'Đang active, engagement ổn' },
  { label: '🟢 Normal', min: 0.2,  max: 1,        description: 'Bài thường, đang lưu thông trong feed' },
  { label: '🔵 Cooling',min: 0.05, max: 0.2,      description: 'Giảm nhiệt, sắp rời hot pool' },
  { label: '⚫ Cold',   min: 0,    max: 0.05,     description: 'Đã hết vòng đời ranking, về cold pool' },
];

export const getScoreTier = (score) => {
  return SCORE_TIERS.find(t => score >= t.min && score < t.max) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
};

// ─────────────────────────────────────────────────────────────────────────────
// Interaction weights — UNLIKE has negative weight [FIX B3]
// ─────────────────────────────────────────────────────────────────────────────
const WEIGHTS = {
  'CLICK':        1,
  'LIKE':         2,
  'UNLIKE':      -2, 
  'COMMENT':      3,
  'SHARE':        4,
  'DECAY_UPDATE': 0,  // Periodic recalc: no new interactions, just re-score with updated T
};

// ─────────────────────────────────────────────────────────────────────────────
// [FIX B2] Lua script: atomic init-if-missing + increment
//
// Without this, two concurrent workers could both see key=null,
// both SET the bootstrap value, then both INCRBY — causing double-counting.
// Redis Lua scripts execute atomically (no interleaving), fixing the race.
//
// KEYS[1] = counter key
// ARGV[1] = bootstrap value (initial raw score from DB)
// ARGV[2] = weight to add (can be negative for UNLIKE)
// ARGV[3] = TTL in seconds
// ─────────────────────────────────────────────────────────────────────────────
const ATOMIC_INIT_INCR = `
  local current = redis.call('GET', KEYS[1])
  if current == false then
    redis.call('SET', KEYS[1], ARGV[1])
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
  elseif tonumber(redis.call('TTL', KEYS[1])) == -1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
  end
  local result = redis.call('INCRBY', KEYS[1], ARGV[2])
  if tonumber(result) < 0 then
    redis.call('SET', KEYS[1], '0')
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    return 0
  end
  return result
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: bootstrap raw score from DB (called only on cache miss)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchBootstrapData(postId) {
  // 1. Lấy dữ liệu từ SQL
  const { data: post, error } = await supabaseService
    .from('posts')
    .select('created_at, likes_count, comments_count, shares_count')
    .eq('id', postId)
    .single();

  if (error || !post) return null;

  // 2. Lấy dữ liệu real-time từ Redis để bù đắp cho buffer chưa sync
  // Chú ý: likes lưu dạng SET, comments lưu dạng SET (mới update) hoặc STRING (cũ)
  const redisLikes = await redisClient.scard(`post:${postId}:likes`);
  
  // Tương thích ngược: thử SCARD, nếu lỗi thì thử GET (do comments cũ lưu STRING)
  let redisComments = 0;
  try {
    const type = await redisClient.type(`post:${postId}:comments`);
    if (type === 'set') {
      redisComments = await redisClient.scard(`post:${postId}:comments`);
    } else {
      const val = await redisClient.get(`post:${postId}:comments`);
      redisComments = Number(val || 0);
    }
  } catch (e) {
    redisComments = 0;
  }

  // Ưu tiên giá trị lớn nhất (giữa DB đã sync và Redis đang hot)
  const finalLikes    = Math.max(post.likes_count, Number(redisLikes || 0));
  const finalComments = Math.max(post.comments_count, Number(redisComments || 0));
  const finalShares   = post.shares_count; // Shares thường ít burst hơn, tạm dùng DB

  const rawScore = (finalLikes * 2) + (finalComments * 3) + (finalShares * 4);
  return { createdAt: post.created_at, rawScore };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Processor
// ─────────────────────────────────────────────────────────────────────────────
export const rankingProcessor = async (job) => {
  // Handle repeatable scheduler job to trigger decay refresh
  if (job.name === 'DECAY_SCHEDULER_JOB') {
    const { runDecayRefresh } = await import('./ranking.scheduler.js');
    await runDecayRefresh();
    return { success: true, isScheduler: true };
  }

  const { postId, interactionType } = job.data;

  if (!postId || !interactionType) {
    throw new Error('Missing postId or interactionType');
  }

  const interactionKey       = interactionType.toUpperCase();
  const weight               = WEIGHTS[interactionKey] ?? 1;
  const totalInteractionsKey = `post:${postId}:interactions:total`;
  const createdAtCacheKey    = `post:${postId}:created_at`;

  // ── STEP 1: Resolve created_at & bootstrap score ──────────────────────────
  let createdAtStr = await redisClient.get(createdAtCacheKey);
  let bootstrapScore = 0;

  if (!createdAtStr) {
    // Cache miss → fetch from DB (only happens once per post lifecycle)
    const data = await fetchBootstrapData(postId);
    if (!data) throw new Error(`Post ${postId} not found in DB`);

    createdAtStr   = data.createdAt;
    bootstrapScore = data.rawScore;

    await redisClient.set(createdAtCacheKey, createdAtStr, 'EX', CREATED_AT_TTL);
  } else {
    // Check if interactions counter is already initialized; if not, bootstrap
    const existing = await redisClient.get(totalInteractionsKey);
    if (existing === null) {
      const data = await fetchBootstrapData(postId);
      bootstrapScore = data?.rawScore ?? 0;
    }
  }

  // ── STEP 2: Calculate post age ─────────────────────────────────────────────
  const now = Date.now();
  const hoursSinceCreated = (now - new Date(createdAtStr).getTime()) / (1000 * 60 * 60);
  const isInActivePool = hoursSinceCreated <= ACTIVE_HOURS;

  // ── STEP 3: [FIX B2] Atomic init-if-missing + increment via Lua ───────────
  let totalInteractions;

  if (weight !== 0) {
    // Lua runs atomically: no race between two concurrent workers
    totalInteractions = await redisClient.eval(
      ATOMIC_INIT_INCR,
      1,
      totalInteractionsKey,
      String(bootstrapScore),
      String(weight),
      String(INTERACTIONS_TTL) // [FIX G2] TTL was missing before
    );
    totalInteractions = Number(totalInteractions);
  } else {
    // DECAY_UPDATE: just read existing score, don't add interactions
    const current = await redisClient.get(totalInteractionsKey);
    totalInteractions = current ? Number(current) : bootstrapScore;

    // Ensure TTL is set if missing [FIX G2]
    const ttl = await redisClient.ttl(totalInteractionsKey);
    if (ttl === -1) {
      await redisClient.expire(totalInteractionsKey, INTERACTIONS_TTL);
    }
  }

  // ── STEP 4: Compute time-decayed score ────────────────────────────────────
  // Formula: Score = (WeightedInteractions + CMS_Bonus) / (HoursAge + 2)^DecayFactor
  // The +2 avoids division-by-zero and dampens extreme bias for brand-new posts
  const denominator = Math.pow(Math.max(0, hoursSinceCreated) + 2, DECAY_FACTOR);
  const score       = (totalInteractions + CMS_BONUS) / denominator;

  // ── STEP 5: PLAN — Active/Cold partitioning + Sliding Window ──────────────
  if (isInActivePool) {
    // Hot pool: post is fresh (≤ ACTIVE_HOURS), gets full ranking treatment
    await redisClient.zadd(HOT_ZSET, score, postId);
    await redisClient.zrem(COLD_ZSET, postId); // promote back if re-engaged

    // [FIX G3] Sliding window: trim to MAX_HOT_SIZE lowest-score entries
    // zremrangebyrank removes from rank 0 (lowest) up to -(N+1) from top
    await redisClient.zremrangebyrank(HOT_ZSET, 0, -(MAX_HOT_SIZE + 1));
  } else {
    // Cold pool: post is old, move out of hot ranking
    // Still track in cold ZSET for "all-time popular" queries if needed
    await redisClient.zrem(HOT_ZSET, postId);
    await redisClient.zadd(COLD_ZSET, score, postId);
    await redisClient.zremrangebyrank(COLD_ZSET, 0, -(MAX_COLD_SIZE + 1));
  }

  return {
    success: true,
    postId,
    score,
    totalInteractions,
    isInActivePool,
    hoursSinceCreated: Math.round(hoursSinceCreated),
  };
};
