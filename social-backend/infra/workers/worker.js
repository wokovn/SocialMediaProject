import dotenv from 'dotenv';
dotenv.config();

import {
  postlikeSyncWorker,
  commentWorker,
  shareWorker,
  followWorker,
  mediaResizeWorker,
  mediaCleanupWorker,
  notificationWorker,
  rankingWorker,
  fanoutWorker,
} from './workers.factory.js';

console.log('Starting BullMQ workers...\n');

const workers = [
  { name: 'Like Worker', worker: postlikeSyncWorker },
  { name: 'Comment Worker', worker: commentWorker },
  { name: 'Share Worker', worker: shareWorker },
  { name: 'Follow Worker', worker: followWorker },
  { name: 'Media Resize Worker', worker: mediaResizeWorker },
  { name: 'Media Cleanup Worker', worker: mediaCleanupWorker },
  { name: 'Notification Worker', worker: notificationWorker },
  { name: 'Ranking Worker', worker: rankingWorker },
  { name: 'Fanout Worker', worker: fanoutWorker },
];

workers.forEach(({ name, worker }) => {
  if (worker) {
    console.log(`${name} started`);
  } else {
    console.warn(`${name} skipped (Redis disabled)`);
  }
});

console.log('\nAll workers are running and listening for jobs...\n');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, closing workers gracefully...');
  await Promise.all(workers.filter(w => w.worker).map(({ worker }) => worker.close()));
  console.log('All workers closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, closing workers gracefully...');
  await Promise.all(workers.filter(w => w.worker).map(({ worker }) => worker.close()));
  console.log('All workers closed');
  process.exit(0);
});
