# Startup Guide

Full instructions for running the Social Z app locally.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Redis)
- A running PostgreSQL instance (e.g. [Supabase](https://supabase.com/))

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

# JWT
JWT_SECRET=your_jwt_secret
```

### Frontend — `social-frontend/.env`

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

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

The SQL schemas are in `docs/database/`. Run them in order against your PostgreSQL instance to set up the tables:

1. `user-create.sql`
2. `users-alter-add-full-name.sql`
3. `posts-create.sql`
4. `posts-alter-visibility.sql`
5. `comments-create.sql`
6. `likes-create.sql`
7. `follows-create.sql`
8. `bookmarks-create.sql`
9. `media-create.sql`
