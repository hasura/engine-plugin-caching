import { describe, it } from 'node:test';
import assert from 'node:assert';
import { addHeadersToRequest, generateCacheKey } from './request.js';
import { Config } from './config.js';

describe('generateCacheKey', () => {
  const mockRawRequest = {
    rawRequest: {
      query: 'query GetUser($id: ID!) { user(id: $id) { name email } }',
      operationName: 'GetUser',
      variables: { id: '123' },
      customField: 'customValue'
    },
    session: {
      role: 'user',
      variables: { userId: '456' }
    }
  };
  const mockHeaders = {
      'X-Hasura-Unique-Cache-Key': 'unique-key',
      'Authorization': 'Bearer token',
      'Content-Type': 'application/json'
    };
  const mockRequest = addHeadersToRequest(mockRawRequest, mockHeaders);

  describe('with default config (Config.cache_key)', () => {
    it('should achieve backwards compatibility - old behavior with specific config', () => {
      // Generate key with null config (old behavior - fallback case)
      const resultOldBehavior = generateCacheKey(mockRequest, null);

      // Generate key with explicit config that should match old behavior
      // Old behavior: rawRequest: { query: parsed, ...req }, session: request.session
      // Note: req = { variables, customField, ... } (operationName was destructured out)
      const backwardsCompatibleConfig = {
        rawRequest: {
          query: true,
          // operationName: true,  // NOT included in old behavior!
          variables: true,
          // This should include all other fields from req (...req)
        },
        session: true,
        // No headers in old behavior
      };

      const resultExplicitConfig = generateCacheKey(mockRequest, backwardsCompatibleConfig);

      // Both should produce identical cache keys
      assert.strictEqual(resultOldBehavior, resultExplicitConfig);

      // Verify the structure matches old behavior expectations
      const parsedOld = JSON.parse(resultOldBehavior);
      const parsedExplicit = JSON.parse(resultExplicitConfig);

      assert.deepStrictEqual(parsedOld, parsedExplicit);

      // Old behavior should have rawRequest and session, but no headers
      assert.ok(parsedOld.hasOwnProperty('rawRequest'));
      assert.ok(parsedOld.hasOwnProperty('session'));
      assert.ok(!parsedOld.hasOwnProperty('headers'));

      // Verify rawRequest contains query (parsed AST) and other fields
      assert.ok(parsedOld.rawRequest.hasOwnProperty('query'));
      assert.ok(!parsedOld.rawRequest.hasOwnProperty('operationName')); // NOT in old behavior
      assert.ok(parsedOld.rawRequest.hasOwnProperty('variables'));
      assert.ok(parsedOld.rawRequest.hasOwnProperty('customField')); // from ...req
    });
  });

  describe('with custom cache_key_config', () => {
    it('should include query in rawRequest when configured', () => {
      const config = {
        rawRequest: {
          query: true
        }
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.rawRequest.hasOwnProperty('query'));
      assert.ok(parsed.rawRequest.query !== undefined);
      assert.strictEqual(parsed.rawRequest.customField, 'customValue');
    });

    it('should include operationName when configured', () => {
      const config = {
        rawRequest: {
          operationName: true
        }
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.rawRequest.hasOwnProperty('operationName'));
      assert.strictEqual(parsed.rawRequest.operationName, 'GetUser');
    });

    it('should include variables when configured', () => {
      const config = {
        rawRequest: {
          variables: true
        }
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.rawRequest.hasOwnProperty('variables'));
      assert.deepStrictEqual(parsed.rawRequest.variables, { id: '123' });
    });

    it('should include session when configured', () => {
      const config = {
        session: true
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.hasOwnProperty('session'));
      assert.deepStrictEqual(parsed.session, mockRequest.session);
    });

    it('should include specified headers when configured', () => {
      const config = {
        headers: ['X-Hasura-Unique-Cache-Key', 'Authorization']
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.hasOwnProperty('headers'));
      assert.deepStrictEqual(parsed.headers, {
        'x-hasura-unique-cache-key': 'unique-key',
        'authorization': 'Bearer token'
      });
    });

    it('should not include headers not specified in config', () => {
      const config = {
        headers: ['X-Hasura-Unique-Cache-Key']
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.deepStrictEqual(parsed.headers, {
        'x-hasura-unique-cache-key': 'unique-key'
      });
      assert.ok(!parsed.headers.hasOwnProperty('Authorization'));
    });

    it('should throw error for missing required headers', () => {
      const config = {
        headers: ['Non-Existent-Header']
      };

      assert.throws(
        () => generateCacheKey(mockRequest, config),
        {
          name: 'Error',
          message: "Required header 'Non-Existent-Header' for cache key is missing from request"
        }
      );
    });

    it('should work correctly when all required headers are present', () => {
      const config = {
        headers: ['X-Hasura-Unique-Cache-Key', 'Authorization']
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.hasOwnProperty('headers'));
      assert.deepStrictEqual(parsed.headers, {
        'x-hasura-unique-cache-key': 'unique-key',
        'authorization': 'Bearer token'
      });
    });
  });

  describe('with complex configurations', () => {
    it('should handle full configuration with all options', () => {
      const config = {
        rawRequest: {
          query: true,
          operationName: true,
          variables: true
        },
        session: true,
        headers: ['X-Hasura-Unique-Cache-Key']
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.hasOwnProperty('rawRequest'));
      assert.ok(parsed.hasOwnProperty('session'));
      assert.ok(parsed.hasOwnProperty('headers'));

      assert.ok(parsed.rawRequest.hasOwnProperty('query'));
      assert.ok(parsed.rawRequest.hasOwnProperty('operationName'));
      assert.ok(parsed.rawRequest.hasOwnProperty('variables'));
      assert.ok(parsed.rawRequest.hasOwnProperty('customField'));

      assert.deepStrictEqual(parsed.session, mockRequest.session);
      assert.deepStrictEqual(parsed.headers, {
        'x-hasura-unique-cache-key': 'unique-key'
      });
    });

    it('should not include rawRequest when no rawRequest config is provided', () => {
      const config = {
        session: true,
        headers: ['X-Hasura-Unique-Cache-Key']
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      assert.ok(!parsed.hasOwnProperty('rawRequest'));
      assert.ok(parsed.hasOwnProperty('session'));
      assert.ok(parsed.hasOwnProperty('headers'));
    });
  });

  describe('edge cases', () => {
    it('should handle null cache_key_config', () => {
      const result = generateCacheKey(mockRequest, null);
      const parsed = JSON.parse(result);

      assert.ok(parsed.hasOwnProperty('rawRequest'));
      assert.ok(parsed.hasOwnProperty('session'));
      assert.ok(parsed.rawRequest.hasOwnProperty('query'));
      assert.deepStrictEqual(parsed.session, mockRequest.session);
    });

    it('should handle empty cache_key_config', () => {
      const result = generateCacheKey(mockRequest, {});
      const parsed = JSON.parse(result);

      assert.strictEqual(Object.keys(parsed).length, 0);
    });

    it('should handle request without operationName', () => {
      const requestWithoutOperationName = {
        ...mockRequest,
        rawRequest: {
          ...mockRequest.rawRequest,
          operationName: null
        }
      };

      const config = {
        rawRequest: {
          operationName: true
        }
      };

      const result = generateCacheKey(requestWithoutOperationName, config);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.rawRequest.operationName, null);
    });

    it('should handle request with empty headers object', () => {
      const requestWithoutHeaders = {
        ...mockRequest,
        headers: {}
      };

      const config = {
        headers: ['X-Hasura-Unique-Cache-Key']
      };

      assert.throws(
        () => generateCacheKey(requestWithoutHeaders, config),
        {
          name: 'Error',
          message: "Required header 'X-Hasura-Unique-Cache-Key' for cache key is missing from request"
        }
      );
    });

    it('should handle mixed-case header keys correctly', () => {
      const newMockHeaders = {
          'X-HASURA-UNIQUE-CACHE-KEY': 'unique-key',  // uppercase
          'authorization': 'Bearer token',             // lowercase
          'Content-Type': 'application/json'          // mixed case
        }
      const requestWithMixedCaseHeaders = addHeadersToRequest(mockRawRequest, newMockHeaders);

      const config = {
        headers: ['X-Hasura-Unique-Cache-Key', 'Authorization', 'content-type']
      };

      const result = generateCacheKey(requestWithMixedCaseHeaders, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.hasOwnProperty('headers'));
      assert.deepStrictEqual(parsed.headers, {
        'x-hasura-unique-cache-key': 'unique-key',
        'authorization': 'Bearer token',
        'content-type': 'application/json'
      });
    });

    it('should normalize header keys to lowercase in cache key', () => {
      const requestWithMixedCaseHeaders = addHeadersToRequest(mockRawRequest, {
        'Authorization': 'Bearer token'
      });

      const config = {
        headers: ['AUTHORIZATION']  // config uses uppercase
      };

      const result = generateCacheKey(requestWithMixedCaseHeaders, config);
      const parsed = JSON.parse(result);

      assert.ok(parsed.hasOwnProperty('headers'));
      assert.deepStrictEqual(parsed.headers, {
        'authorization': 'Bearer token'  // normalized to lowercase
      });
    });
  });

  describe('GraphQL parsing and location stripping', () => {
    it('should parse GraphQL query and strip locations', () => {
      const config = {
        rawRequest: {
          query: true
        }
      };

      const result = generateCacheKey(mockRequest, config);
      const parsed = JSON.parse(result);

      // The query should be parsed into an AST object
      assert.strictEqual(typeof parsed.rawRequest.query, 'object');
      assert.ok(parsed.rawRequest.query.hasOwnProperty('kind'));
      assert.strictEqual(parsed.rawRequest.query.kind, 'Document');

      // Locations should be stripped (no 'loc' properties)
      const hasLocProperty = (obj) => {
        if (typeof obj !== 'object' || obj === null) return false;
        if (obj.hasOwnProperty('loc')) return true;
        return Object.values(obj).some(hasLocProperty);
      };

      assert.strictEqual(hasLocProperty(parsed.rawRequest.query), false);
    });
  });

  describe('deterministic output', () => {
    it('should produce the same cache key for identical requests', () => {
      const config = {
        rawRequest: {
          query: true,
          operationName: true,
          variables: true
        },
        session: true
      };

      const result1 = generateCacheKey(mockRequest, config);
      const result2 = generateCacheKey(mockRequest, config);

      assert.strictEqual(result1, result2);
    });

    it('should produce different cache keys for different requests', () => {
      const config = {
        rawRequest: {
          query: true,
          variables: true
        }
      };

      const request2 = {
        ...mockRequest,
        rawRequest: {
          ...mockRequest.rawRequest,
          variables: { id: '456' } // Different variable value
        }
      };

      const result1 = generateCacheKey(mockRequest, config);
      const result2 = generateCacheKey(request2, config);

      assert.notStrictEqual(result1, result2);
    });
  });
});
