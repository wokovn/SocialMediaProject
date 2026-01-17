import redis from 'ioredis'
import dotenv from 'dotenv';
dotenv.config();

const redisClient = new redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
})

export default redisClient;