// Default job options
export const queueOptions = {
  attempts: parseInt(process.env.QUEUE_JOB_ATTEMPTS || '3'),
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || '100'),
  },
  removeOnFail: {
    count: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || '500'),
  },
};

