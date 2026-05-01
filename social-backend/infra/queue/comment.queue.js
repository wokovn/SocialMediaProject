import { createQueue } from '../workers/workers.config.js';
import QueueNames from './queue.names.js';

export const commentSyncQueue = createQueue(QueueNames.POST_COMMENT_QUEUE);
