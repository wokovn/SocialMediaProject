# Docker Workflow Guide

We have split the infrastructure into two configurations: Development and Production.

## Local Development (Dev)
The dev environment uses volume mapping to sync your local code with the container for hot-reloading.

### 1. Start Supabase (Required first)
Since Supabase has its own complex multi-container orchestration, we use the official Supabase CLI:
```powershell
# In the root project folder
supabase start
```
*Tip: Once started, your `.env` should point to the local Supabase URLs (e.g., `http://127.0.0.1:54321`).*

### 2. Start Redis, Backend & Frontend
```powershell
# In the root project folder
docker-compose -f docker-compose.dev.yaml up -d --build
```

---

## Production Deployment (Prod)
The production config is optimized for performance, security, and resource limits.

### 1. Build and Run
```powershell
# Launch the full stack from the root folder
docker-compose -f docker-compose.prod.yaml up -d --build
```

### Key Differences
| Feature | Development (`docker-compose.dev.yaml`) | Production (`docker-compose.prod.yaml`) |
| :--- | :--- | :--- |
| **Code Sync** | Volume mapping (hot reload) | Image baked-in (immutable) |
| **Node Mode** | `development` | `production` |
| **Logging** | Human-readable Terminal logs | JSON structure + Docker log rotation |
| **Redis Persistence** | Local `redis_data_dev` volume | Local `redis_data_prod` volume |
| **Supabase** | Expects `supabase start` via CLI | Expects remote/cloud Supabase strings |

## Cleanup
To stop everything:
```powershell
docker-compose -f docker-compose.dev.yaml down
supabase stop
```