import { createQueue } from '../workers/workers.config.js';
import QueueNames from './queue.names.js';

export const followSyncQueue = createQueue(QueueNames.USER_FOLLOW_QUEUE);
