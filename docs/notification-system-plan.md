# 🔔 Realtime Notification System — Implementation Plan

> **Decisions confirmed:**
> - Aggregation: **Hybrid** — backend lưu `group_key`, frontend group khi hiển thị
> - Actor info: **Metadata** (denormalize `actor_name`, `actor_avatar` vào notification)
> - Notification preference: **Chưa cần** phase 1
> - Phase 1 scope: Like, Comment, Follow, Share

---

## 1. Kiến trúc tổng thể

```
Event Producers (Like, Comment, Follow, Share)
        │
        ▼
  dispatchNotification()  ← single entry point
        │
        ▼
  BullMQ: notification_queue
        │
        ▼
  Notification Worker (N instances)
        │
        ├── 1. Fetch actor info (name, avatar) → denormalize vào metadata
        ├── 2. Persist to PostgreSQL (với group_key)
        ├── 3. Increment unread counter (Redis)
        ├── 4. Online check (Redis: user:online:<id>)
        └── 5. Emit via Redis Emitter → Socket.IO → Client 🔔
                                                        │
                                                        ▼
                                              Frontend group by group_key
                                              "A, B và 3 người khác đã thích..."
```

### Scale ngang

| Concern | Giải pháp |
|---|---|
| Socket.IO multi-instance | `@socket.io/redis-adapter` ✅ đã có |
| Worker emit từ process khác | `@socket.io/redis-emitter` ✅ đã có |
| Job distribution | BullMQ ✅ đã có — mỗi job chỉ 1 worker xử lý |
| Presence tracking | Redis `user:online:<userId>` ✅ đã có |

---

## 2. Database Migration

```sql
-- Migration: Add group_key for notification aggregation
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS group_key VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_notifications_group_key
  ON public.notifications (user_id, group_key, created_at DESC)
  WHERE deleted_at IS NULL;
```

**`group_key` format**: `<type>:<action>:<targetId>`
- Like: `INTERACTION:LIKE:<postId>`
- Comment: `INTERACTION:COMMENT:<postId>`
- Follow: `SOCIAL:FOLLOW:<userId>`

**metadata** sẽ chứa: `{ actor_name, actor_avatar, postTitle?, commentPreview? }`

---

## 3. Redis Keys mới

Thêm vào `infra/redis/redis.key.js`:

```js
// notif:unread:<userId> → STRING (number)
notifUnread: (userId) => `notif:unread:${userId}`,
```

> Không cần Redis aggregation keys nữa — frontend tự group.

---

## 4. File mới: `modules/notifications/notifications.service.js`

Single entry point dispatch notification. Mọi module chỉ gọi hàm này.

```js
export async function dispatchNotification({
  userId, actorId, type, action, targetId, targetUrl, metadata = {}
}) {
  if (userId === actorId) return; // Don't self-notify
  if (!notificationQueue) return;

  const groupKey = `${type}:${action}:${targetId}`;
  await notificationQueue.add('dispatch', {
    user_id: userId, actor_id: actorId,
    type, action, group_key: groupKey,
    target_url: targetUrl, metadata,
  }, queueOptions);
}
```

---

## 5. Cập nhật: `notification.processor.js` (Simplified)

```js
export const notificationProcessor = async (job) => {
  const { user_id, actor_id, type, action, group_key, target_url, metadata } = job.data;

  // Step 1: Fetch actor info for denormalization
  const { data: actor } = await supabaseService
    .from('users').select('full_name, avatar_url').eq('id', actor_id).single();

  const enrichedMetadata = {
    ...metadata,
    actor_name: actor?.full_name || 'Người dùng',
    actor_avatar: actor?.avatar_url || null,
  };

  // Step 2: Persist
  const { data: notification, error } = await supabaseService
    .from('notifications')
    .insert([{ user_id, actor_id, type, action, group_key, target_url, metadata: enrichedMetadata }])
    .select().single();
  if (error) throw new Error(`Insert failed: ${error.message}`);

  // Step 3: Increment unread
  if (redisClient) await redisClient.incr(RedisKeys.notifUnread(user_id));

  // Step 4: Realtime delivery if online
  let deliveredRealtime = false;
  if (redisClient) {
    const isOnline = await redisClient.exists(RedisKeys.userOnline(user_id));
    if (isOnline) {
      const emitter = getEmitter();
      emitter.to(`user:${user_id}`).emit('NEW_NOTIFICATION', notification);
      const count = await redisClient.get(RedisKeys.notifUnread(user_id));
      emitter.to(`user:${user_id}`).emit('UNREAD_COUNT', { count: parseInt(count || '0') });
      deliveredRealtime = true;
    }
  }

  return { success: true, notificationId: notification.id, deliveredRealtime };
};
```

---

## 6. Tích hợp dispatch vào các flow

### Like (trong `posts.service.js` sau khi SADD):
```js
await dispatchNotification({
  userId: post.authorId, actorId: currentUserId,
  type: 'INTERACTION', action: 'LIKE', targetId: postId,
  targetUrl: `/post/${postId}`,
  metadata: { postTitle: post.content?.substring(0, 80) }
});
```

### Comment, Follow, Share — tương tự, thay action + metadata phù hợp.

---

## 7. API Endpoints mở rộng

Thêm vào `notifications.controller.js`:
- `GET /api/notifications/unread-count` — đọc Redis counter, fallback COUNT DB
- `PATCH /api/notifications/read-all` — update DB + reset Redis counter
- `GET /api/notifications` — thêm pagination (`page`, `limit`)

---

## 8. Frontend

### 8.1 Install: `npm i socket.io-client`

### 8.2 `src/lib/socketProvider.jsx` — React Context, connect socket + heartbeat

### 8.3 `src/hooks/useNotifications.js`
- Fetch notifications + unread count on mount
- Listen `NEW_NOTIFICATION` / `UNREAD_COUNT` socket events
- **Frontend grouping logic**: group by `group_key`, hiển thị "A, B và N người khác..."
- `markAsRead(id)`, `markAllAsRead()`

### 8.4 `src/components/NotificationBell.jsx`
- Chuông + badge unread count
- Dropdown panel, lazy-load khi mở
- Render grouped notifications

---

## 9. Checklist

### Phase 1: Backend Core
- [ ] Migration: thêm `group_key`
- [ ] Redis key: `notifUnread`
- [ ] Tạo `notifications.service.js`
- [ ] Cập nhật `notification.processor.js`
- [ ] Thêm API endpoints

### Phase 2: Integrate Triggers
- [ ] Like flow → `dispatchNotification()`
- [ ] Comment flow
- [ ] Follow flow
- [ ] Share flow

### Phase 3: Frontend
- [ ] `socket.io-client` + `SocketProvider`
- [ ] `useNotifications` hook (với frontend grouping)
- [ ] `NotificationBell` component
- [ ] Tích hợp vào Navbar

### Phase 4: Test
- [ ] Aggregation display
- [ ] Multi-instance delivery
- [ ] Offline → online (thấy notification khi mở app)

---

## 10. Extensibility

```
notification.processor.js
  ├── IN_APP   (WebSocket — phase 1)
  ├── EMAIL    (future)
  └── PUSH     (Web Push API — future, không cần mobile app)
```

## 11. Production Notes

| Concern | Giải pháp |
|---|---|
| Self-notification | Skip khi `userId === actorId` |
| Cleanup | Cron xóa notification > 90 ngày |
| Monitoring | Bull Board dashboard |
| Redis memory | TTL trên unread counter |
