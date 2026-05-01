import { createQueue } from '../workers/workers.config.js';
import QueueNames from './queue.names.js';

export const notificationQueue = createQueue(QueueNames.NOTIFICATION_QUEUE);
