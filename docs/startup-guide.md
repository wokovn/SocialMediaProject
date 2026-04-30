# Startup Guide

Full instructions for running the Social Z app locally.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Redis)
- A running PostgreSQL instance (e.g. [Supabase](https://supabase.com/))
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local Supabase stack)
- [FFmpeg](https://ffmpeg.org/) available on PATH (for media resize/thumbnail worker)

---

## Quick Start (One Command)

From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\fast-start.ps1
```

This script will:

- Install dependencies if `node_modules` is missing
- Start Redis using `docker compose` from `social-backend/docker-compose.yaml`
- Open three terminals for API server, worker, and frontend dev server

Optional flags:

```powershell
# skip dependency installation
powershell -ExecutionPolicy Bypass -File .\fast-start.ps1 -SkipInstall

# skip redis startup
powershell -ExecutionPolicy Bypass -File .\fast-start.ps1 -SkipRedis

# start all services as background jobs in current terminal
powershell -ExecutionPolicy Bypass -File .\fast-start.ps1 -SameWindow
```

---

## Supabase Local (CLI)

Use this path if you want a fully local Supabase stack (DB + Auth + Storage + Realtime + Studio)
and you want to pull the schema from your cloud project without data.

1. Install the CLI (one of these):

```bash
npm install -g supabase
# or
npx supabase --version
```

2. Initialize Supabase in the repo root:

```bash
supabase init
```

3. Link to your cloud project (schema source):

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

4. Pull the schema (no data):

```bash
supabase db pull
```

5. Start the local stack (Docker must be running):

```bash
supabase start
```

6. Copy local values from `supabase status` into your env files:

- `API URL` -> `SUPABASE_URL` and `VITE_SUPABASE_URL` (usually `http://localhost:54321`)
- `anon key` -> `VITE_SUPABASE_ANON_KEY`
- `service_role key` -> `SUPABASE_SERVICE_ROLE_KEY`
- `DB URL` -> `DATABASE_URL`

7. Apply migrations to local DB (empty by default):

```bash
supabase db reset
```

If you keep `supabase/seed.sql` empty, the database stays empty.

8. Create the storage bucket used by the app (once):

- In Studio: `http://localhost:54323` -> Storage -> New bucket -> `media` (public)
- Or SQL:

```sql
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
```

---

## 1. Environment Variables

### Backend — `social-backend/.env`

Create this file before starting anything:

```env
# Server
PORT=3000

# PostgreSQL (Supabase or self-hosted)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Media storage (single bucket + folder prefixes)
SUPABASE_MEDIA_BUCKET=media
SUPABASE_TMP_PREFIX=tmp
SUPABASE_POST_MEDIA_PREFIX=post_media
SUPABASE_PROFILE_PICTURE_PREFIX=profile_picture
SUPABASE_WEB_CONTENT_PREFIX=web_content
SUPABASE_POST_MEDIA_VARIANTS_PREFIX=post_media_variants

# Media cleanup worker
MEDIA_TMP_TTL_MINUTES=180
MEDIA_ORPHAN_GRACE_MINUTES=30
MEDIA_CLEANUP_INTERVAL_MS=3600000

# Media resize worker tuning
MEDIA_IMAGE_VARIANT_SMALL_SIZE=480
MEDIA_IMAGE_VARIANT_MAX_SIZE=960
MEDIA_IMAGE_VARIANT_HIGH_SIZE=1440
MEDIA_VIDEO_THUMBNAIL_MAX_SIZE=960
MEDIA_VIDEO_THUMBNAIL_SEEK_SECONDS=0.5
```

### Frontend — `social-frontend/.env`

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PASSWORD_RESET_REDIRECT_URL=http://localhost:5173/reset-password
```

Post media uploads are sent to backend `POST /api/media/upload-temp` and stored using service-role credentials.
This avoids client-side Supabase Storage insert failures from RLS policies.
Backend workers/endpoints then move files inside the same bucket from `tmp/...` into `post_media/...`, `profile_picture/...`, and `post_media_variants/...`.

`VITE_PASSWORD_RESET_REDIRECT_URL` must be added to Supabase Auth Redirect URLs in your project settings.

---

## 2. Start Redis (Docker)

From the `social-backend/` directory:

```bash
docker-compose up -d
```

This starts the `social_z_redis` container on the port defined by `REDIS_PORT` (default `6379`).

To stop it:

```bash
docker-compose down
```

---

## 3. Install Dependencies

```bash
# Backend
cd social-backend
npm install

# Frontend
cd ../social-frontend
npm install
```

---

## 4. Start the Backend

Run both the API server and the BullMQ worker in separate terminals.

**Terminal 1 — API server:**

```bash
cd social-backend
npm run dev        # development (nodemon)
# or
npm start          # production
```

The server starts on `http://localhost:3000`.  
Health check: `GET http://localhost:3000/health`

**Terminal 2 — BullMQ worker:**

```bash
cd social-backend
npm run worker:dev   # development (nodemon)
# or
npm run worker       # production
```

The worker listens for background jobs (e.g. like sync) from Redis queues.

---

## 5. Start the Frontend

```bash
cd social-frontend
npm run dev
```

The frontend starts on `http://localhost:5173` (Vite default).

---

## Full Startup Order (Summary)

| Step | Command | Directory |
|------|---------|-----------|
| 1. Start Redis | `docker-compose up -d` | `social-backend/` |
| 2. Start API server | `npm run dev` | `social-backend/` |
| 3. Start BullMQ worker | `npm run worker:dev` | `social-backend/` |
| 4. Start frontend | `npm run dev` | `social-frontend/` |

---

## Database

If you are using Supabase CLI with `supabase db pull`, the schema lives in
`supabase/migrations/` and `supabase db reset` applies it locally.

Otherwise, the SQL schemas are in `docs/database/`. Run them in order against
your PostgreSQL instance to set up the tables:

1. `user-create.sql`
2. `users-alter-add-full-name.sql`
3. `posts-create.sql`
4. `posts-alter-visibility.sql`
5. `comments-create.sql`
6. `likes-create.sql`
7. `follows-create.sql`
8. `bookmarks-create.sql`
9. `media-create.sql`
