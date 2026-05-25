import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from '../redis/redis.config.js';
import RedisKeys from '../redis/redis.key.js';

let io;

export const initializeWebsocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Adjust to your frontend URL in production
      methods: ['GET', 'POST'],
    },
  });

  if (redisClient) {
    try {
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();

      // Tránh unhandled error event crash process
      pubClient.on('error', () => {});
      subClient.on('error', () => {});

      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket] Redis adapter enabled.');
    } catch (err) {
      console.warn('[Socket] Failed to create Redis adapter, falling back to memory adapter:', err.message);
    }
  } else {
    console.log('[Socket] Redis disabled, using memory adapter.');
  }

  io.on('connection', (socket) => {
    // Frontend should send userId when connecting
    const userId = socket.handshake.query.userId || socket.handshake.auth.userId;
    
    if (userId) {
      // Join a dedicated room for this user to receive direct notifications
      socket.join(`user:${userId}`);
      console.log(`User ${userId} connected on socket ${socket.id}`);
      
      // Update presence immediately upon connection
      updateOnlinePresence(userId);
    }

    // Heartbeat mechanism to keep presence alive
    socket.on('presence_heartbeat', (data) => {
      const uid = data?.userId || userId;
      if (uid) {
        updateOnlinePresence(uid);
      }
    });

    socket.on('disconnect', async () => {
      if (userId) {
        try {
          if (redisClient) {
            await redisClient.del(RedisKeys.userOnline(userId));
          }
        } catch (err) {
          console.warn('[Presence] Redis unavailable on disconnect:', err.message);
        }
        io.emit('USER_STATUS_CHANGED', { userId, status: 'offline' });
      }
    });
  });

  return io;
};

const updateOnlinePresence = async (userId) => {
  if (!redisClient) return; // Presence disabled without Redis
  try {
    const ttl = parseInt(process.env.PRESENCE_ONLINE_TTL || '60', 10);
    const key = RedisKeys.userOnline(userId);
    
    // Try to set the key only if it does not exist (NX)
    const result = await redisClient.set(key, '1', 'EX', ttl, 'NX');
    
    if (result === 'OK') {
      // Key was newly created -> User came online
      if (io) {
        io.emit('USER_STATUS_CHANGED', { userId, status: 'online' });
      }
    } else {
      // Key already exists -> User is still online, just refresh the TTL
      await redisClient.expire(key, ttl);
    }
  } catch (err) {
    console.warn('[Presence] Redis unavailable, skipping presence update:', err.message);
  }
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};
