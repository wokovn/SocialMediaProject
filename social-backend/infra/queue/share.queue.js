import { createQueue } from '../workers/workers.config.js';
import QueueNames from './queue.names.js';

export const shareSyncQueue = createQueue(QueueNames.POST_SHARE_QUEUE);
