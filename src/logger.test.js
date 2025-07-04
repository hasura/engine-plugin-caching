import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { logger } from './logger.js';

describe('Logger', () => {
  let originalConsole;
  let capturedLogs;

  beforeEach(() => {
    // Capture console output for testing
    capturedLogs = [];
    originalConsole = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    console.error = (msg) => capturedLogs.push({ level: 'ERROR', message: msg });
    console.warn = (msg) => capturedLogs.push({ level: 'WARN', message: msg });
    console.info = (msg) => capturedLogs.push({ level: 'INFO', message: msg });
    console.debug = (msg) => capturedLogs.push({ level: 'DEBUG', message: msg });

    // Reset logger level to INFO for consistent testing
    logger.level = 2; // INFO
  });

  afterEach(() => {
    // Restore original console
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  it('should format log entries as JSON', () => {
    logger.info('Test message', { normalKey: 'value' });

    assert.strictEqual(capturedLogs.length, 1);
    const logEntry = JSON.parse(capturedLogs[0].message);

    assert.strictEqual(logEntry.level, 'INFO');
    assert.strictEqual(logEntry.message, 'Test message');
    assert.strictEqual(logEntry.service, 'engine-plugin-caching');
    assert.strictEqual(logEntry.normalKey, 'value');
    assert.ok(logEntry.timestamp);
  });

  it('should sanitize sensitive data', () => {
    const sensitiveData = {
      password: 'secret123',
      token: 'abc123',
      'hasura-m-auth': 'secret-header',
      normalField: 'safe-value',
      session: { user: 'john' },
      headers: ['x-custom-header']
    };

    logger.info('Test with sensitive data', sensitiveData);
    
    assert.strictEqual(capturedLogs.length, 1);
    const logEntry = JSON.parse(capturedLogs[0].message);
    
    // Sensitive fields should be redacted
    assert.strictEqual(logEntry.password, '[REDACTED]');
    assert.strictEqual(logEntry.token, '[REDACTED]');
    assert.strictEqual(logEntry['hasura-m-auth'], '[REDACTED]');
    assert.strictEqual(logEntry.session, '[REDACTED_OBJECT]');
    assert.strictEqual(logEntry.headers, '[1 headers configured]');
    
    // Normal fields should be preserved
    assert.strictEqual(logEntry.normalField, 'safe-value');
  });

  it('should log cache operations with appropriate context', () => {
    logger.logCacheOperation('lookup', {
      key: 'cache-key-123',
      queryMatched: true,
      ttl: 60
    });

    assert.strictEqual(capturedLogs.length, 1);
    const logEntry = JSON.parse(capturedLogs[0].message);

    assert.strictEqual(logEntry.message, 'Cache operation: lookup');
    assert.strictEqual(logEntry.operation, 'lookup');
    assert.strictEqual(logEntry.cacheKey, '[CACHE_KEY_HASH]');
    assert.strictEqual(logEntry.queryMatched, true);
    assert.strictEqual(logEntry.ttl, 60);
  });

  it('should log HTTP requests with sanitized information', () => {
    logger.logHttpRequest('POST', '/pre-parse', 200, {
      userAgent: 'test-agent',
      duration: 150
    });
    
    assert.strictEqual(capturedLogs.length, 1);
    const logEntry = JSON.parse(capturedLogs[0].message);
    
    assert.strictEqual(logEntry.message, 'HTTP POST /pre-parse');
    assert.strictEqual(logEntry.method, 'POST');
    assert.strictEqual(logEntry.path, '/pre-parse');
    assert.strictEqual(logEntry.statusCode, 200);
    assert.strictEqual(logEntry.userAgent, 'test-agent');
    assert.strictEqual(logEntry.duration, 150);
  });

  it('should respect log levels', () => {
    // Set logger to WARN level
    logger.level = 1; // WARN
    
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');
    
    // Only WARN and ERROR should be logged
    assert.strictEqual(capturedLogs.length, 2);
    assert.strictEqual(JSON.parse(capturedLogs[0].message).level, 'WARN');
    assert.strictEqual(JSON.parse(capturedLogs[1].message).level, 'ERROR');
  });

  it('should handle nested sensitive objects', () => {
    // Reset logger level to ensure INFO logs are captured
    logger.level = 2; // INFO

    const nestedData = {
      user: {
        name: 'John',
        password: 'secret',
        session: {
          token: 'abc123',
          role: 'admin'
        }
      },
      config: {
        redis_url: 'redis://localhost',
        secret: 'hidden'
      }
    };

    logger.info('Nested sensitive data', nestedData);

    assert.strictEqual(capturedLogs.length, 1);
    const logEntry = JSON.parse(capturedLogs[0].message);

    // Check nested sanitization
    assert.strictEqual(logEntry.user.name, 'John');
    assert.strictEqual(logEntry.user.password, '[REDACTED]');
    assert.strictEqual(logEntry.user.session, '[REDACTED_OBJECT]');
    assert.strictEqual(logEntry.config.redis_url, 'redis://localhost');
    assert.strictEqual(logEntry.config.secret, '[REDACTED]');
  });
});
