# System Logging Architecture

This document describes the logging infrastructure for the application, designed around **Pino** (high-throughput JSON logger) and **AsyncLocalStorage** for request traceability.

## Overview
Our logging system consists of:
1. **Pino**: Chosen for its incredible performance, native JSON output, and asynchronous logging capabilities.
2. **Pino-HTTP**: Express middleware that automatically logs all incoming requests and outgoing responses.
3. **Pino-Roll**: A transport that handles log file rotation automatically.
4. **AsyncLocalStorage (ALS)**: A native Node.js feature that provides a way to trace a single request's lifecycle across asynchronous boundaries without polluting parameter signatures.

## Log Locations
Logs are routed based on the environment:
*   **Console Output**: In development, logs are pretty-printed to the terminal (`pino-pretty` formats the raw JSON into colorized readable text).
*   **File Output (`/logs/` directory)**: Logs are saved as structured JSON in the `social-backend/logs/` directory.

### Rotation Policy & Identity
*   **File Naming**: Active logs will prefix with `app`, e.g., `app.log`.
*   **Size Limit**: Logs automatically rotate when they reach **10MB**. This prevents disk bloat and memory issues.
*   **Interval Rotation**: Logs rotate on a **Daily (1d)** schedule even if the size limit isn't reached.
*   The system creates the `logs` folder automatically upon the first log event.

## Trace ID (Correlation ID)
Every log generated within the context of an HTTP request will automatically contain a `traceId`.
This is achieved via `traceMiddleware` inside `social-backend/app.js`.

### Why `traceId`?
When your server operates at scale, logs from multiple concurrent users interleave. A `traceId` allows you to filter the log files (or your log aggregator, like Datadog/CloudWatch) for a single unique ID to see the entire lifecycle of a specific request, from inbound API hit -> DB Query -> Redis cache -> Outbound Response.

## How to use the logger in code
You should avoid using `console.log`, `console.warn`, etc. Instead, import the central logger instance.

```javascript
import { logger } from '../../infra/logger/logger.js';

function doSomethingImportant(user) {
    // ❌ Bad
    console.log(`User ${user.id} logged in`); 
    
    // ✅ Good (Structured JSON, carries TraceID automatically)
    logger.info({ userId: user.id }, 'User logged in successfully');

    try {
        // ...
    } catch (error) {
        // ✅ Good Error Logging
        logger.error({ err: error, userId: user.id }, 'Failed to login user');
    }
}
```

## Disabling Logs (Tests)
When `NODE_ENV=test`, the logger level is set to `silent`. This ensures that unit tests run blazingly fast without polluting the terminal or creating test log files.