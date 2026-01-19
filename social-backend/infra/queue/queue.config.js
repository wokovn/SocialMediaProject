// Default job options
export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,
  },
  removeOnFail: {
    count: 500,
  },
};

