import { createQueue } from '../workers/workers.config.js';
import QueueNames from './queue.names.js';

export const likeSyncQueue = createQueue(QueueNames.LIKE_SYNC_QUEUE);
