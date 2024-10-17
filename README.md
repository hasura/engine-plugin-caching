# Server-side caching plugin

A simple plugin for caching requests on the server in-memory.

## Installation

_See `tests/` for a working `docker compose` setup. It is assumed that you will
be running `npm run dev` when you `docker compose up`._

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
    value: http://my.plugin.server.com:8787
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
    value: http://my.plugin.server.com:8787
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

### Tracing

OpenTelemetry is configured in the `wrangler.toml` file by setting the
following two environment variables:

```
OTEL_EXPORTER_OTLP_ENDPOINT = "https://gateway.otlp.hasura.io:443/v1/traces"
OTEL_EXPORTER_PAT = "<PAT>"
```

### Execution

Execution configuration is found in `src/config.ts`. Currently, there are three
available keys:

#### Expected `headers`

```javascript
headers: { "hasura-m-auth": "my-secret-header" }
```

Headers expected from the `engine` when a request to the plugin is made.
Currently, only one header is expected: `hasura-m-auth` is a user-specified
secret that the engine should send over in its requests.

#### A list of `queriesToCache`

```javascript
queriesToCache: [
  "query { Artist { Name } }",
  "query { Album { Artist { Name } } }"
]
```

When a user makes a request to the server, the caching plugin will parse the
request into an AST, and then check to see whether the AST matches the AST of
any of these queries. If it does, the query will be cached. This means that
whitespace is unimportant in these queries, and you can write them over
multiple lines.

#### The `timeToLive` for a cache entry

```javascript
timeToLive: 600
```

The length of time after which a given cache entry should be invalidated. This
is measured in seconds.
