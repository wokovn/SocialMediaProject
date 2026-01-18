import dotenv from 'dotenv';
dotenv.config();

import likeWorker from './posts/like.worker.js';
import unlikeWorker from './posts/unlike.worker.js';
import commentWorker from './posts/comment.worker.js';
import shareWorker from './posts/share.worker.js';
import followWorker from './users/follow.worker.js';
import unfollowWorker from './users/unfollow.worker.js';

console.log('🚀 Starting BullMQ workers...\n');

const workers = [
  { name: 'Like Worker', worker: likeWorker },
  { name: 'Unlike Worker', worker: unlikeWorker },
  { name: 'Comment Worker', worker: commentWorker },
  { name: 'Share Worker', worker: shareWorker },
  { name: 'Follow Worker', worker: followWorker },
  { name: 'Unfollow Worker', worker: unfollowWorker },
];

workers.forEach(({ name, worker }) => {
  console.log(`✓ ${name} started`);
});

console.log('\n✨ All workers are running and listening for jobs...\n');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, closing workers gracefully...');
  await Promise.all(workers.map(({ worker }) => worker.close()));
  console.log('✓ All workers closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, closing workers gracefully...');
  await Promise.all(workers.map(({ worker }) => worker.close()));
  console.log('✓ All workers closed');
  process.exit(0);
});
