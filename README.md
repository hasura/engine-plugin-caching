# Server-side caching plugin

A simple plugin for Hasura DDN server-side request caching.

## Installation

### Starting the plugin

The plugin can be run for local development using `docker`:

```
$ docker build -t caching-plugin .
$ docker run -p 8787:8787 caching-plugin
```

### Adding the plugin to a Hasura project

Add the following configuration to one of your Hasura DDN subgraphs. The first
block describes the "pre-parse" stage, which will return the cached response if
it exists and the given query is marked for caching.

```yaml
kind: LifecyclePluginHook
version: v1
definition:
  pre: parse
  name: cache_get_test
  url:
    value: http://localhost:8787
  config:
    request:
      headers:
        additional:
          hasura-m-auth:
            value: my-secret-header
          hasura-plugin-phase:
            value: pre-parse
      rawRequest:
        query: {}
        variables: {}
```

The second block describes the "pre-response" stage, which will cache the
response if it hasn't already been cached and if the given query is marked for
caching.

```yaml
kind: LifecyclePluginHook
version: v1
definition:
  pre: response
  name: cache_set_test
  url:
    value: http://localhost:8787
  config:
    request:
      headers:
        additional:
          hasura-m-auth:
            value: my-secret-header
          hasura-plugin-phase:
            value: pre-response
      rawRequest:
        query: {}
        variables: {}
```

## Configuration

Configuration is found in `src/config.js`. Currently, there are three available
keys:

#### Expected `headers`

```javascript
headers: { "hasura-m-auth": "my-secret-header" }
```

Headers expected from the `engine` when a request to the plugin is made.
Currently, only one header is expected: `hasura-m-auth` is a user-specified
secret that the engine should send over in its requests.

#### A list of `queries_to_cache`

```javascript
queries_to_cache: [
  { query: "query { Artist { Name } }", time_to_live: 60 },
  { query: "query { Album { Artist { Name } } }", time_to_live: 120 }
];
```

When a user makes a request to the server, the caching plugin will parse the
request into an AST, and then check to see whether the AST matches the AST of
any of these queries. If it does, the query will be cached for the given amount
of time. This means that whitespace is unimportant in these queries, and you
can write them over multiple lines.

A result will be cached for each set of session and query variables that use
this same query template.

#### A `redis_url` for storing the cache entries.

```javascript
redis_url: "redis://redis:6379";
```

#### An `otel_endpoint` for OpenTelemetry traces.

```javascript
otel_endpoint: "http://jaeger:4318/v1/traces";
```

#### Any other `otel_headers` for the trace collector.

```javascript
otel_headers: {
  Authorization: "pat <my-personal-access-token>";
}
```
