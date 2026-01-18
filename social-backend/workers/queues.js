import { Queue } from 'bullmq';
import { redisConnection, defaultJobOptions } from './workers.config.js';

// Define all application queues

// Posts related queues
export const likeQueue = new Queue('post:like', {
  connection: redisConnection,
  defaultJobOptions,
});

export const unlikeQueue = new Queue('post:unlike', {
  connection: redisConnection,
  defaultJobOptions,
});

export const commentQueue = new Queue('post:comment', {
  connection: redisConnection,
  defaultJobOptions,
});

export const shareQueue = new Queue('post:share', {
  connection: redisConnection,
  defaultJobOptions,
});

// User related queues
export const followQueue = new Queue('user:follow', {
  connection: redisConnection,
  defaultJobOptions,
});

export const unfollowQueue = new Queue('user:unfollow', {
  connection: redisConnection,
  defaultJobOptions,
});

// Notification queue
export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions,
});

// Email queue
export const emailQueue = new Queue('emails', {
  connection: redisConnection,
  defaultJobOptions,
});

export default {
  likeQueue,
  unlikeQueue,
  commentQueue,
  shareQueue,
  followQueue,
  unfollowQueue,
  notificationQueue,
  emailQueue,
};
