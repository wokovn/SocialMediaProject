# Testing Guidelines

This project uses a **100% Mock-Based Test Suite** to guarantee fast, deterministic execution across all environments without the overhead of Docker, test containers, or live databases. 

When generating or updating tests for this repository, you **must adhere to these instructions**:

## 1. Core Principles
- **No E2E testing.** Use Vitest strictly for Unit and Integration tests.
- **No real Database/Redis/Queue connections.** Every test must execute completely offline, interacting only with memory and explicitly mocked implementations.

## 2. Backend Testing (social-backend/)
- **Framework**: `vitest` with `supertest` for API integration logic.
- **Mocking**: 
  - ALWAYS mock the Data Access Layer (e.g., `drizzle-orm` queries, Supabase clients).
  - ALWAYS mock Redis stores (`ioredis`). See `social-backend/test/setup.js` for base global mocks.
  - ALWAYS mock Background Queues (`bullmq`). Do not let producers try to connect to a live Redis broker.
- **Running**: Use `npm run test` or `npm run test:run`. Code should execute in milliseconds.

### Example Backend Mock Pattern
```javascript
import { vi, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import db from '../db/db.js';

// Mock DB entirely
vi.mock('../db/db.js', () => ({
  default: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: 1, name: 'Mock User' }])
  }
}));

describe('Integration | GET /api/users', () => {
  it('returns a mocked user correctly', async () => {
    const res = await request(app).get('/api/users/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Mock User');
  });
});
```

## 3. Frontend Testing (social-frontend/)
- **Framework**: `vitest` + `@testing-library/react` + `jsdom`.
- **Mocking**:
  - Mock Network (`fetch`, `axios`) or use `msw` (Mock Service Worker).
  - Mock third-party providers (Supabase Auth Client, Socket.io, React Router hooks like `useNavigate`).
- **Setup**: `social-frontend/src/setupTests.js` auto-injects jest-dom. You can use standard assertions like `expect(element).toBeInTheDocument()`.

## 4. Verification Check
If you run `npm run test:run` and a test hangs for 10+ seconds or throws `ECONNREFUSED` related to localhost ports (Postgres 5432, Redis 6379), **your mock is leaking**. Fix the mock immediately before proceeding.
