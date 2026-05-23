import 'dotenv/config';
import app from './app.js';
import redisClient, { enableHybridPersistence } from './infra/redis/redis.config.js';
import { createServer } from 'http';
import { initializeWebsocket } from './infra/websocket/socket.js';

const PORT = process.env.PORT || 3000;

if (redisClient) {
  redisClient
    .ping()
    .then(async (message) => {
      console.log(`Redis connected: ${message}`);
      await enableHybridPersistence();
    })
    .catch((error) => {
      console.warn(`[warn] Redis unavailable. API is running in degraded mode: ${error.message}`);
    });
} else {
  console.log('[info] Redis is disabled. API is running in degraded mode.');
}

const server = createServer(app);

// Khởi tạo Websocket Gateway
initializeWebsocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
