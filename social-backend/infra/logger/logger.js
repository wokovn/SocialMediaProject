import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

export const traceStorage = new AsyncLocalStorage();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
    level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
    transport: isTest ? undefined : {
        targets: [
            ...(isProduction || process.env.DOCKER_CONTAINER === 'true' ? [] : [{
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname'
                }
            }]),
            {
                target: 'pino-roll',
                options: {
                    file: 'logs/app',
                    size: '10m', // Rotate when file size reaches 10MB
                    interval: '1d', // Rotate daily
                    mkdir: true, // Ensure the logs directory is created
                }
            }
        ]
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
