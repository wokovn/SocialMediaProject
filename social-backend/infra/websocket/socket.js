import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from '../redis/redis.config.js';

let io;

export const initializeWebsocket = (httpServer) => {
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();

  io = new Server(httpServer, {
    cors: {
      origin: '*', // Adjust to your frontend URL in production
      methods: ['GET', 'POST'],
    },
  });

  io.adapter(createAdapter(pubClient, subClient));

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
        // When disconnected, we can either rely on TTL or actively remove
        // Actively removing here. If the user has multiple tabs, the other tab's heartbeat will bring them back.
        await redisClient.del(`user:online:${userId}`);
        io.emit('USER_STATUS_CHANGED', { userId, status: 'offline' });
      }
    });
  });

  return io;
};

const updateOnlinePresence = async (userId) => {
  const ttl = parseInt(process.env.PRESENCE_ONLINE_TTL || '60', 10);
  const key = `user:online:${userId}`;
  
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
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};
