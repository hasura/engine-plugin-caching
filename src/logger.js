/**
 * JSON Logger for the caching engine plugin
 * Provides structured logging while avoiding sensitive data exposure
 *
 * ## Usage
 *
 * The plugin uses structured JSON logging for better observability and monitoring.
 * All logs are output in JSON format with the following structure:
 *
 * ```json
 * {
 *   "timestamp": "2024-01-01T12:00:00.000Z",
 *   "level": "INFO",
 *   "service": "engine-plugin-caching",
 *   "message": "Cache operation: lookup",
 *   "operation": "lookup",
 *   "queryMatched": true
 * }
 * ```
 *
 * ## Log Levels
 *
 * Set the `LOG_LEVEL` environment variable to control logging verbosity:
 *
 * - `ERROR`: Only error messages
 * - `WARN`: Warnings and errors
 * - `INFO`: General information, warnings, and errors (default)
 * - `DEBUG`: All messages including debug information
 *
 * ## Security
 *
 * The logging system automatically sanitizes sensitive data to prevent accidental exposure of:
 *
 * - Passwords, tokens, and secrets
 * - Authentication headers (hasura-m-auth, authorization, etc.)
 * - Session data and user variables
 * - Raw GraphQL queries and variables
 * - Request headers
 *
 * Sensitive fields are replaced with `[REDACTED]` or `[REDACTED_OBJECT]` placeholders.
 *
 * ## Log Types
 *
 * The plugin generates several types of structured logs:
 *
 * - **HTTP Requests**: Method, path, status code, duration
 * - **Cache Operations**: Lookup, write, hit/miss status
 * - **Configuration**: Startup and initialization events
 * - **Redis Events**: Connection, errors, reconnection attempts
 * - **Validation Errors**: Request validation failures
 * - **Authentication**: Authorization failures (without exposing tokens)
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
};

class Logger {
  constructor() {
    // Default to INFO level, can be overridden by environment variable
    this.level = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
    this.serviceName = 'engine-plugin-caching';
  }

  parseLogLevel(level) {
    const upperLevel = level.toUpperCase();
    return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
  }

  shouldLog(level) {
    return level <= this.level;
  }

  formatLogEntry(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: LOG_LEVEL_NAMES[level],
      service: this.serviceName,
      message,
      ...this.sanitizeContext(context),
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Sanitize context to remove sensitive data
   * This prevents accidental logging of secrets, tokens, or personal data
   */
  sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const sanitized = {};
    const sensitiveKeys = [
      'password', 'token', 'secret', 'auth', 'authorization',
      'hasura-m-auth', 'x-hasura-admin-secret', 'cookie'
    ];

    // Special handling for specific keys that should be treated as sensitive objects
    const sensitiveObjectKeys = ['session', 'variables', 'rawRequest', 'headers'];

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();

      // Check if key is explicitly a sensitive object
      if (sensitiveObjectKeys.includes(key)) {
        if (key === 'headers' && Array.isArray(value)) {
          // For header arrays in cache config, just log the count
          sanitized[key] = `[${value.length} headers configured]`;
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = '[REDACTED_OBJECT]';
        } else {
          sanitized[key] = '[REDACTED]';
        }
      }
      // Check if key contains sensitive information
      else if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = '[REDACTED_OBJECT]';
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  error(message, context = {}) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatLogEntry(LOG_LEVELS.ERROR, message, context));
    }
  }

  warn(message, context = {}) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatLogEntry(LOG_LEVELS.WARN, message, context));
    }
  }

  info(message, context = {}) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.info(this.formatLogEntry(LOG_LEVELS.INFO, message, context));
    }
  }

  debug(message, context = {}) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.debug(this.formatLogEntry(LOG_LEVELS.DEBUG, message, context));
    }
  }

  /**
   * Log cache operations with appropriate context
   */
  logCacheOperation(operation, context = {}) {
    this.info(`Cache operation: ${operation}`, {
      operation,
      cacheKey: context.key ? '[CACHE_KEY_HASH]' : undefined,
      queryMatched: context.queryMatched,
      ttl: context.ttl,
      found: context.found,
      error: context.error?.message,
    });
  }

  /**
   * Log HTTP requests with sanitized information
   */
  logHttpRequest(method, path, statusCode, context = {}) {
    this.info(`HTTP ${method} ${path}`, {
      method,
      path,
      statusCode,
      userAgent: context.userAgent,
      duration: context.duration,
      error: context.error?.message,
    });
  }

  /**
   * Log configuration initialization
   */
  logConfigInit(context = {}) {
    this.info('Configuration initialized', {
      redisConnected: context.redisConnected,
      queriesConfigured: context.queriesConfigured,
      otelEnabled: context.otelEnabled,
    });
  }

  /**
   * Log Redis connection events
   */
  logRedisEvent(event, context = {}) {
    const level = event === 'error' ? LOG_LEVELS.ERROR : LOG_LEVELS.INFO;
    if (this.shouldLog(level)) {
      const logMethod = event === 'error' ? this.error.bind(this) : this.info.bind(this);
      logMethod(`Redis ${event}`, {
        event,
        error: context.error?.message,
        reconnecting: context.reconnecting,
      });
    }
  }
}

// Export a singleton instance
export const logger = new Logger();
export default logger;
