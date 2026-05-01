import { createQueue } from '../workers/workers.config.js';
import QueueNames from './queue.names.js';

export const mediaResizeQueue  = createQueue(QueueNames.MEDIA_RESIZE_QUEUE);
export const mediaCleanupQueue = createQueue(QueueNames.MEDIA_CLEANUP_QUEUE);