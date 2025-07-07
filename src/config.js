export const Config = {
  // Hasura secret to verify the sender.
  headers: { "hasura-m-auth": "zZkhKqFjqXR4g5MZCsJUZCnhCcoPyZ" },

  // Cache-key configuration. The fields to include in the cache key.
  cache_key: {
    // The graphql request fields to include in the cache key.
    rawRequest: {
      query: true,
      operationName: false,
      variables: true,
    },
    // Include the entire session object in the cache key
    session: true,
    // Uncomment the following to include headers in the cache key
    headers: [
      // "X-Hasura-Unique-Cache-Key",
    ],
  },

  // A list of queries we'd like to cache.
  //
  // These queries can also be written over multiple lines with whatever
  // indentation you'd prefer, as the hashing key mechanism works in terms of
  // the parsed query, which doesn't preserve whitespace.
  queries_to_cache: [
    { query: "query test { artist { name } }"

      // The time for which a value will survive in the cache. After this, the
      // cache will be invalidated, and the next occurrence of the query will
      // repopulate the cache.
    , time_to_live: 6
    }
  ],

  // The URL for a Redis instance.
  redis_url: "redis://redis:6379",

  // The URL for an opentelemetry collector.
  otel_endpoint: "http://jaeger:4318/v1/traces",

  // Any other OpenTelemetry headers to send to the collector.
  // otel_headers: { Authorization: 'pat <my-personal-access-token>' }
  otel_headers: {},
};
