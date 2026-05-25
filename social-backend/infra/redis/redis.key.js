// ─────────────────────────────────────────────────────────────────────────────
// Redis Key Registry
//
// Tập trung toàn bộ Redis key tại một nơi để:
//   - Tránh typo khi viết key string rải rác trong code
//   - Dễ tra cứu TTL, kiểu dữ liệu, và mục đích của từng key
//   - Dễ đổi namespace khi cần migrate
//
// Quy ước đặt tên:  <domain>:<id>:<sub-type>
// Ví dụ:            post:abc123:likes
// ─────────────────────────────────────────────────────────────────────────────

const RedisKeys = {

  // ── Write-behind Buffers (List) ────────────────────────────────────────────
  // Dùng bởi: posts.redis.js, comment.redis.js, users.redis.js
  // Worker lpop/blpop để flush xuống DB định kỳ
  LIKE_BUFFER:    'like:buffer',
  COMMENT_BUFFER: 'comment:buffer',
  SHARE_BUFFER:   'share:buffer',
  FOLLOW_BUFFER:  'follow:buffer',

  // ── Post Cache (per-post) ──────────────────────────────────────────────────
  // post:<postId>            → STRING  – JSON snapshot của post (getPost)
  post:                (postId) => `post:${postId}`,

  // post:cache:<postId>      → STRING  – JSON cached post data (cache-aside in feed)
  //   TTL: POST_CACHE_TTL + jitter (default 300s + 0-60s)
  postCache:           (postId) => `post:cache:${postId}`,

  // post:<postId>:likes      → SET     – userId đã like (SADD/SREM/SCARD/SISMEMBER)
  postLikes:           (postId) => `post:${postId}:likes`,

  // post:<postId>:comments   → STRING|SET – số comment (INCR cũ / SET mới)
  postComments:        (postId) => `post:${postId}:comments`,

  // comment:<commentId>:replies → STRING – số reply (INCR)
  commentReplies:      (commentId) => `comment:${commentId}:replies`,

  // ── Ranking Engine (per-post) ──────────────────────────────────────────────
  // Dùng bởi: ranking.processor.js, ranking.queue.js

  // post:<postId>:interactions:total → STRING – tổng điểm tương tác (Lua INCRBY)
  //   TTL: RANKING_INTERACTIONS_TTL (default 60 ngày)
  postInteractionsTotal: (postId) => `post:${postId}:interactions:total`,

  // post:<postId>:created_at → STRING – ISO timestamp tạo bài (cache từ DB)
  //   TTL: RANKING_CREATED_AT_TTL (default 14 ngày)
  postCreatedAt:       (postId) => `post:${postId}:created_at`,

  // lock:ranking:<postId>    → STRING – throttle lock, NX EX RANKING_THROTTLE_SECONDS
  rankingLock:         (postId) => `lock:ranking:${postId}`,

  // ── Global Ranking ZSETs (Sorted Set, score = time-decayed) ───────────────
  // Dùng bởi: ranking.processor.js, ranking.scheduler.js, posts.service.js
  HOT_ZSET:  'global_trending_feed', // Bài ≤ RANKING_ACTIVE_HOURS giờ tuổi
  COLD_ZSET: 'global_cold_feed',     // Bài > RANKING_ACTIVE_HOURS giờ tuổi

  // ── User Feed (per-user) ───────────────────────────────────────────────────
  // Dùng bởi: fanout.processor.js, posts.service.js

  // user_feed:<userId>       → LIST  – postId của bài trong feed cá nhân
  //   Giới hạn bởi LTRIM MAX_FEED_SIZE
  userFeed:            (userId) => `user_feed:${userId}`,

  // idol_posts:<userId>      → LIST  – postId của idol (pull model)
  //   Giới hạn bởi LTRIM MAX_FEED_SIZE
  idolPosts:           (userId) => `idol_posts:${userId}`,

  // user:seen:<userId>       → SET   – postId đã thấy (lọc trùng lặp feed)
  //   TTL: 7 ngày (604800s)
  userSeen:            (userId) => `user:seen:${userId}`,

  // ── User Social Graph (per-user) ───────────────────────────────────────────
  // Dùng bởi: users.redis.js

  // user:<userId>:following  → SET   – userId mà user đang follow
  userFollowing:       (userId) => `user:${userId}:following`,

  // user:<userId>:followers  → SET   – userId đang follow user này
  userFollowers:       (userId) => `user:${userId}:followers`,

  // ── Presence (per-user) ────────────────────────────────────────────────────
  // Dùng bởi: socket.js, notification.processor.js

  // user:online:<userId>     → STRING – "1" nếu đang online
  //   TTL: PRESENCE_ONLINE_TTL (default 60s), refresh bởi heartbeat
  userOnline:          (userId) => `user:online:${userId}`,

  // ── Auth / Security ────────────────────────────────────────────────────────
  // Dùng bởi: auth.redis.js

  // jwt:blacklist:<token>    → STRING – token đã bị revoke (logout)
  jwtBlacklist:        (token) => `jwt:blacklist:${token}`,

  // ── Notifications (per-user) ───────────────────────────────────────────────
  // Dùng bởi: notification.processor.js, notifications.controller.js

  // notif:unread:<userId> → STRING (number) - Số lượng thông báo chưa đọc
  notifUnread:         (userId) => `notif:unread:${userId}`,

  // notif:dedupe:<userId>:<actorId>:<type>:<action>:<targetId> → STRING
  //   TTL: 3 giây – chống double-click / rapid-action spam
  notifDedupe:         ({ userId, actorId, type, action, targetId }) =>
    `notif:dedupe:${userId}:${actorId}:${type}:${action}:${targetId}`,

  // notification_buffer → LIST – pending notifications waiting for batch flush
  NOTIFICATION_BUFFER: 'notification_buffer',
};

export default RedisKeys;