import dotenv from 'dotenv';
import app from './app.js';
import redisClient from './infra/redis/redis.config.js';
// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

redisClient
  .ping()
  .then((message) => {
    console.log(`Redis connected: ${message}`);
  })
  .catch((error) => {
    console.warn(`[warn] Redis unavailable. API is running in degraded mode: ${error.message}`);
  });

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
