import { createQueue } from '../workers/workers.config.js';
import QueueNames from './queue.names.js';

export const fanoutQueue = createQueue(QueueNames.FANOUT_QUEUE);
