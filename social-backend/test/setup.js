import { vi } from 'vitest';

// Global mocks for backend tests to ensure no real connection is made to DB/Redis/Queues
vi.mock('ioredis', () => {
  class MockRedis {
    constructor() {
      this.get = vi.fn();
      this.set = vi.fn();
      this.del = vi.fn();
      this.quit = vi.fn();
      this.on = vi.fn();
      this.status = 'ready';
    }
  }
  return {
    default: MockRedis,
    Redis: MockRedis
  };
});

vi.mock('bullmq', () => {
  class MockQueue {
    constructor() {
      this.add = vi.fn();
      this.on = vi.fn();
      this.close = vi.fn();
    }
  }
  class MockWorker {
    constructor() {
      this.on = vi.fn();
      this.close = vi.fn();
    }
  }
  return {
    Queue: MockQueue,
    Worker: MockWorker
  };
});
