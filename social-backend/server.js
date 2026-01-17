import dotenv from 'dotenv';
import app from './app.js';
import redisService from './modules/redis/redis.service.js';
import redisClient from './modules/redis/redis.config.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

const message = await redisClient.ping();
console.log(message);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
