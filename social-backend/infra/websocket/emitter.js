import { Emitter } from '@socket.io/redis-emitter';
import redisClient from '../redis/redis.config.js';

let emitter;

export const getEmitter = () => {
  if (!emitter) {
    if (redisClient) {
      try {
        const pubClient = redisClient.duplicate();
        emitter = new Emitter(pubClient);
        console.log('[Socket Emitter] Redis emitter initialized.');
      } catch (err) {
        console.warn('[Socket Emitter] Failed to initialize Redis emitter:', err.message);
      }
    }
    
    if (!emitter) {
      console.log('[Socket Emitter] Using no-op emitter.');
      emitter = {
        to: () => emitter,
        emit: () => {},
        in: () => emitter,
        of: () => emitter,
      };
    }
  }
  return emitter;
};
