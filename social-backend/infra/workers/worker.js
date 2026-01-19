import dotenv from 'dotenv';
dotenv.config();

import {postlikeSyncWorker} from './workers.factory.js';

console.log('Starting BullMQ workers...\n');

const workers = [
  { name: 'Like Worker', worker: postlikeSyncWorker },
];

workers.forEach(({ name, worker }) => {
  console.log(`${name} started`);
});

console.log('\nAll workers are running and listening for jobs...\n');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, closing workers gracefully...');
  await Promise.all(workers.map(({ worker }) => worker.close()));
  console.log('All workers closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, closing workers gracefully...');
  await Promise.all(workers.map(({ worker }) => worker.close()));
  console.log('All workers closed');
  process.exit(0);
});
