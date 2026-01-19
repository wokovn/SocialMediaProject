# Redis Keys Documentation

This document outlines all Redis keys and queues used in the Social Media Project for caching and background job processing.

---

## Table of Contents
- [Cache Keys](#cache-keys)
  - [Posts](#posts)
  - [Authentication](#authentication)
- [BullMQ Queue Keys](#bullmq-queue-keys)
  - [Post Queues](#post-queues)
  - [User Queues](#user-queues)
- [Key Naming Conventions](#key-naming-conventions)
- [TTL (Time To Live) Settings](#ttl-time-to-live-settings)

---

## Cache Keys

### Posts

#### Post Data Cache
**Pattern:** `post:{postId}`

**Type:** String (JSON)

**Description:** Caches full post data including content, metadata, and user information

**Example:**
```
post:123
```

**Value Structure:**
```json
{
  "id": 123,
  "user_id": 456,
  "content": "Post content...",
  "created_at": "2026-01-19T10:00:00Z",
  "visibility": "public"
}
```

---

#### Post Like Count
**Pattern:** `post:{postId}:likes`

**Type:** String (Number)

**Description:** Stores the total number of likes for a post

**Example:**
```
post:123:likes → "42"
```

**Operations:**
- `INCR` when a user likes the post
- `DECR` when a user unlikes the post
- `GET` to retrieve the current count

---

#### Post Like Users Set
**Pattern:** `post:{postId}:like_users`

**Type:** Set

**Description:** Set of user IDs who have liked the post. Used to prevent duplicate likes and for quick membership checks.

**Example:**
```
post:123:like_users → {456, 789, 101}
```

**Operations:**
- `SADD` to add a user who liked the post
- `SREM` to remove a user who unliked the post
- `SISMEMBER` to check if a user has liked the post

---

#### Post Comment Count
**Pattern:** `post:{postId}:comments`

**Type:** String (Number)

**Description:** Stores the total number of comments on a post

**Example:**
```
post:123:comments → "15"
```

**Operations:**
- `INCR` when a new comment is added
- `DECR` when a comment is deleted

---

#### Post Share Count
**Pattern:** `post:{postId}:shares`

**Type:** String (Number)

**Description:** Stores the total number of times a post has been shared

**Example:**
```
post:123:shares → "8"
```

**Operations:**
- `INCR` when a post is shared

---

### Authentication

#### JWT Blacklist
**Pattern:** `jwt:blacklist:{token}`

**Type:** String

**Description:** Stores blacklisted JWT tokens (e.g., after logout). The key expires automatically based on the token's expiration time.

**Example:**
```
jwt:blacklist:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... → "1"
```

**TTL:** Set to match the token's remaining lifetime (exp - current_time)

**Operations:**
- `SET` with TTL when user logs out
- `GET` to check if token is blacklisted

---

### Users

#### User Profile Cache
**Pattern:** `user:{userId}`

**Type:** String (JSON)

**Description:** Caches user profile data

**Example:**
```
user:456
```

**Value Structure:**
```json
{
  "id": 456,
  "username": "johndoe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

#### User Followers Count
**Pattern:** `user:{userId}:followers`

**Type:** String (Number)

**Description:** Stores the total number of followers for a user

**Example:**
```
user:456:followers → "120"
```

**Operations:**
- `INCR` when someone follows the user
- `DECR` when someone unfollows the user

---

#### User Following Count
**Pattern:** `user:{userId}:following`

**Type:** String (Number)

**Description:** Stores the total number of users that this user is following

**Example:**
```
user:456:following → "85"
```

**Operations:**
- `INCR` when user follows someone
- `DECR` when user unfollows someone

---

### Comments

#### Comment Data Cache
**Pattern:** `comment:{commentId}`

**Type:** String (JSON)

**Description:** Caches comment data

**Example:**
```
comment:789
```

**Value Structure:**
```json
{
  "id": 789,
  "post_id": 123,
  "user_id": 456,
  "content": "Great post!",
  "created_at": "2026-01-19T11:00:00Z"
}
```

---

#### Post Comments List
**Pattern:** `post:{postId}:comments:list`

**Type:** List

**Description:** Ordered list of comment IDs for a post (latest first)

**Example:**
```
post:123:comments:list → [789, 788, 787, ...]
```

**Operations:**
- `LPUSH` to add new comment
- `LRANGE` to retrieve comments with pagination

---

### Bookmarks

#### User Bookmarks Set
**Pattern:** `user:{userId}:bookmarks`

**Type:** Set

**Description:** Set of post IDs that the user has bookmarked

**Example:**
```
user:456:bookmarks → {123, 456, 789}
```

**Operations:**
- `SADD` to bookmark a post
- `SREM` to remove bookmark
- `SISMEMBER` to check if post is bookmarked

---

## BullMQ Queue Keys

BullMQ automatically manages these keys, but they follow predictable patterns:

### Post Queues

#### Like Queue
**Queue Name:** `post:like`

**Redis Keys Created:**
- `bull:post:like:id` - Job ID counter
- `bull:post:like:wait` - List of jobs waiting to be processed
- `bull:post:like:active` - Set of active job IDs
- `bull:post:like:completed` - Set of completed job IDs
- `bull:post:like:failed` - Set of failed job IDs
- `bull:post:like:{jobId}` - Individual job data

**Job Data:**
```json
{
  "postId": 123,
  "userId": 456
}
```

**Purpose:** Process post likes asynchronously, update database, send notifications

---

#### Unlike Queue
**Queue Name:** `post:unlike`

**Redis Keys Pattern:** `bull:post:unlike:*`

**Job Data:**
```json
{
  "postId": 123,
  "userId": 456
}
```

**Purpose:** Process post unlikes asynchronously, update database

---

#### Comment Queue
**Queue Name:** `post:comment`

**Redis Keys Pattern:** `bull:post:comment:*`

**Job Data:**
```json
{
  "postId": 123,
  "userId": 456,
  "commentId": 789,
  "content": "Great post!"
}
```

**Purpose:** Process new comments, update post comment count, send notifications to post author

---

#### Share Queue
**Queue Name:** `post:share`

**Redis Keys Pattern:** `bull:post:share:*`

**Job Data:**
```json
{
  "postId": 123,
  "userId": 456,
  "sharedPostId": 999
}
```

**Purpose:** Process post shares, update share count, notify original author

---

### User Queues

#### Follow Queue
**Queue Name:** `user:follow`

**Redis Keys Pattern:** `bull:user:follow:*`

**Job Data:**
```json
{
  "followerId": 456,
  "followingId": 789
}
```

**Purpose:** Process follow actions, update follower/following counts, send notifications

---

#### Unfollow Queue
**Queue Name:** `user:unfollow`

**Redis Keys Pattern:** `bull:user:unfollow:*`

**Job Data:**
```json
{
  "followerId": 456,
  "followingId": 789
}
```

**Purpose:** Process unfollow actions, update follower/following counts

---


## Key Naming Conventions

### General Patterns
1. **Entity Keys:** `{entity}:{id}` - e.g., `post:123`, `user:456`
2. **Entity Properties:** `{entity}:{id}:{property}` - e.g., `post:123:likes`, `user:456:followers`
3. **Entity Collections:** `{entity}:{id}:{collection}` - e.g., `post:123:like_users`
4. **Namespaced Keys:** `{namespace}:{entity}:{id}` - e.g., `jwt:blacklist:{token}`

### Queue Naming
- **Format:** `{entity}:{action}` or `{plural_entity}`
- **Examples:** `post:like`, `user:follow`, `notifications`, `emails`

### BullMQ Internal Keys
- **Format:** `bull:{queueName}:{type}`
- **Types:** `id`, `wait`, `active`, `completed`, `failed`, `delayed`, `paused`

---

## TTL (Time To Live) Settings

### Current TTL Configuration

| Key Pattern | TTL | Notes |
|------------|-----|-------|
| `jwt:blacklist:{token}` | Dynamic | Set to token expiration time |
| `post:{postId}` | 1 hour | Recommended for post cache |
| `user:{userId}` | 30 minutes | Recommended for user cache |
| `post:{postId}:likes` | None | Persistent counter |
| `post:{postId}:like_users` | None | Persistent set |
| `comment:{commentId}` | 30 minutes | Recommended for comment cache |

### Recommended TTL Strategy

#### Short TTL (5-15 minutes)
- Real-time data that changes frequently
- Trending posts
- Active user sessions

#### Medium TTL (30-60 minutes)
- User profiles
- Post data
- Comment threads

#### Long TTL (1-24 hours)
- Static content
- Aggregated statistics
- Historical data

#### No TTL (Persistent)
- Counters (likes, followers, etc.)
- User sets (liked posts, bookmarks)
- Critical state data

---

## Cache Invalidation Strategy

### When to Invalidate

| Event | Keys to Invalidate |
|-------|-------------------|
| Post updated | `post:{postId}` |
| Post deleted | `post:{postId}`, `post:{postId}:*` |
| User updated profile | `user:{userId}` |
| New like | Update `post:{postId}:likes`, add to `post:{postId}:like_users` |
| Unlike | Update `post:{postId}:likes`, remove from `post:{postId}:like_users` |
| New comment | Increment `post:{postId}:comments` |
| New follower | Increment `user:{followingId}:followers` and `user:{followerId}:following` |

---

## Queue Job Configuration

### Default Job Options
```javascript
{
  attempts: 3,                    // Retry up to 3 times on failure
  backoff: {
    type: 'exponential',         // Exponential backoff between retries
    delay: 2000                  // Start with 2 second delay
  },
  removeOnComplete: {
    count: 100                   // Keep last 100 completed jobs
  },
  removeOnFail: {
    count: 500                   // Keep last 500 failed jobs for debugging
  }
}
```

### Worker Options
```javascript
{
  concurrency: 5,                // Process 5 jobs concurrently per worker
  limiter: {
    max: 10,                     // Max 10 jobs
    duration: 1000               // Per 1000ms (rate limiting)
  }
}
```

---

## Redis Data Structure Summary

| Data Type | Use Cases | Keys Using It |
|-----------|-----------|---------------|
| **String** | Simple values, JSON objects, counters | `post:{id}`, `user:{id}`, `post:{id}:likes` |
| **Set** | Unique collections, membership tests | `post:{id}:like_users`, `user:{id}:bookmarks` |
| **List** | Ordered collections, queues | `post:{id}:comments:list`, BullMQ wait lists |
| **Hash** | Object fields (alternative to JSON strings) | Can be used for user/post data optimization |
| **Sorted Set** | Ranked lists, leaderboards | Potential: trending posts, top users |

---

## Monitoring & Debugging

### Useful Redis Commands

```bash
# View all keys matching a pattern
KEYS post:*
KEYS bull:post:like:*

# Check queue status
LLEN bull:post:like:wait        # Waiting jobs
SCARD bull:post:like:active     # Active jobs
SCARD bull:post:like:completed  # Completed jobs
SCARD bull:post:like:failed     # Failed jobs

# Check cache values
GET post:123:likes
SMEMBERS post:123:like_users
GET user:456

# Check TTL
TTL jwt:blacklist:{token}
TTL post:123
```

### Redis Memory Usage

Monitor memory usage with:
```bash
INFO memory
MEMORY USAGE post:123
```

---

## Best Practices

1. **Always set TTL** for cache keys to prevent memory bloat
2. **Use atomic operations** (INCR/DECR) for counters to avoid race conditions
3. **Use Sets** for membership checks instead of scanning arrays
4. **Monitor queue depths** to detect bottlenecks
5. **Implement circuit breakers** for failed jobs
6. **Log job failures** with proper error context
7. **Use Redis transactions** (MULTI/EXEC) for atomic multi-key operations
8. **Implement cache warming** for frequently accessed data
9. **Set up Redis persistence** (AOF/RDB) for important data
10. **Use Redis Cluster** for horizontal scaling if needed

---

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
```

---

*Last Updated: January 19, 2026*
