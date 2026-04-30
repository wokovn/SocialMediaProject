# Social Backend Directory Structure

```text
social-backend/
├── app.js
├── server.js
├── .env
├── infra/
│   ├── queue/
│   │   ├── queue.config.js
│   │   ├── queue.names.js
│   │   ├── notification.queue.js
│   │   ├── ranking.queue.js
│   │   └── fanout.queue.js
│   ├── redis/
│   │   ├── redis.config.js
│   │   └── redis.service.js
│   ├── websocket/
│   │   ├── socket.js
│   │   └── emitter.js
│   └── workers/
│       ├── workers.config.js
│       ├── workers.factory.js
│       ├── worker.js
│       ├── notifications/
│       │   ├── notification.processor.js
│       │   └── notification.worker.js
│       ├── ranking/
│       │   ├── ranking.processor.js
│       │   └── ranking.worker.js
│       └── posts/
│           └── fanout/
│               ├── fanout.processor.js
│               └── fanout.worker.js
└── modules/
    ├── auth/
    │   └── supabase.js
    ├── notifications/
    │   ├── notifications.controller.js
    │   └── notifications.route.js
    └── posts/
        ├── posts.controller.js
        ├── posts.route.js
        └── posts.service.js
```

## Relative Path Cheat Sheet (from Processors)

| From Processor | To Redis Config | To Supabase |
|----------------|-----------------|-------------|
| `notifications/notification.processor.js` | `../../redis/redis.config.js` | `../../../modules/auth/supabase.js` |
| `ranking/ranking.processor.js` | `../../redis/redis.config.js` | `../../../modules/auth/supabase.js` |
| `posts/fanout/fanout.processor.js` | `../../../redis/redis.config.js` | `../../../../modules/auth/supabase.js` |
