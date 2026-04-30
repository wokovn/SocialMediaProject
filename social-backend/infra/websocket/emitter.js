import { Emitter } from '@socket.io/redis-emitter';
import redisClient from '../redis/redis.config.js';

let emitter;

export const getEmitter = () => {
  if (!emitter) {
    const pubClient = redisClient.duplicate();
    emitter = new Emitter(pubClient);
  }
  return emitter;
};
