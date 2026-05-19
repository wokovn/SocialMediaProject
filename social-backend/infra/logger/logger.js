import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

export const traceStorage = new AsyncLocalStorage();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
    level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
    transport: isProduction || isTest ? undefined : {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    },
    mixin() {
        const store = traceStorage.getStore();
        return {
            traceId: store?.traceId
        };
    }
});

// Middleware to start tracing and attach pino-http
export const traceMiddleware = (req, res, next) => {
    const traceId = req.headers['x-correlation-id'] || uuidv4();
    traceStorage.run({ traceId }, () => {
        next();
    });
};
