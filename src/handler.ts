import { Config } from "./config";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { parse } from "graphql";

const tracer = trace.getTracer("caching-plugin")
const storage: { [string]: { response: string, expiry: number } } = {}

// A pre-parse and pre-response plugin handler for caching Hasura requests.
export const cachingHandler = impl => async (env, request) => {
  const token = Config.headers['hasura-m-auth']

  if (request.headers?.get('hasura-m-auth') !== token) {
    return respond(span, {
      code: SpanStatusCode.ERROR,
      trace: 'unauthorised request',
      visibility: null,
      response: { message: 'unauthorised request' },
      status: 500,
    })
  }

  const phase: string | null =
    request.headers?.get('hasura-plugin-phase')

  switch (phase) {
    case 'pre-parse':
      return preParseHandler(env, impl, request)

    case 'pre-response':
      return preResponseHandler(env, impl, request)

    default:
      return respond(span, {
        code: SpanStatusCode.ERROR,
        trace: 'unauthorised request',
        visibility: null,
        response: { message: 'unrecognised phase: ' + phase },
        status: 500
      })
  }
}

// A pre-parse handler for caching Hasura requests. This half is in charge of
// looking up a request in the cache, and determining whether or not to
// continue executing.
export const preParseHandler = (env, impl, request) => {
  return tracer.startActiveSpan('Handle pre-parse request', async span => {
    const rawRequest = <PreParsePluginRequest>await request.json()

    if (rawRequest.rawRequest?.query == null) {
      return respond(span, {
        code: SpanStatusCode.ERROR,
        trace: 'bad request',
        visibility: null,
        response: { message: 'bad request' },
        status: 400,
      })
    }

    const parsed = parse(rawRequest.rawRequest.query);
    stripLocations(parsed);

    const key = makeCacheKey(parsed);

    if (forcedCacheRefresh(parsed)) {
      impl.delete(key)

      return respond(span, {
        code: SpanStatusCode.OK,
        trace: 'user deliberately wiped the cache',
        visibility: 'user',
        response: null,
        status: 204
      })
    } else if (disabledCaching(parsed)) {
      return respond(span, {
        code: SpanStatusCode.OK,
        trace: 'user requested to skip caching',
        visibility: 'user',
        response: null,
        status: 204
      })
    } else if (impl.exists(key)) {
      return respond(span, {
        code: SpanStatusCode.OK,
        trace: 'found query response in cache',
        visibility: 'user',
        response: impl.read(key),
        status: 200
      })
    }

    return respond(span, {
      code: SpanStatusCode.OK,
      trace: 'query not found in cache',
      visibility: 'user',
      response: null,
      status: 204
    })
  })
}

// A pre-response handler for caching Hasura requests. This half is in charge
// of storing a response in the cache according to the request's caching
// directives.
export const preResponseHandler = (env, impl, request) => {
  return tracer.startActiveSpan('Handle response', async span => {
    const rawResponse = <PreResponsePluginRequest>await request.json()

    if (rawResponse.rawRequest?.query == null) {
      return respond(span, {
        code: SpanStatusCode.ERROR,
        trace: 'bad request',
        visibility: null,
        response: { message: 'bad request' },
        status: 400,
      })
    }

    const parsed = parse(rawResponse.rawRequest.query)
    stripLocations(parsed)

    const key = makeCacheKey(parsed);

    if (disabledCaching(parsed)) {
      return respond(span, {
        code: SpanStatusCode.OK,
        trace: 'user requested to skip caching',
        visibility: 'user',
        response: null,
        status: 204
      })
    } else if (requestedCaching(parsed) && !impl.exists(key)) {
      impl.write(key, rawResponse.response, getCacheTTL(env, parsed));

      return respond(span, {
        code: SpanStatusCode.OK,
        trace: 'saved response to cache',
        visibility: 'user',
        response: rawResponse.response,
        status: 200
      })
    }

    return respond(span, {
      code: SpanStatusCode.OK,
      trace: 'nothing saved to cache',
      visibility: 'user',
      response: null,
      status: 200
    })
  })
}

// Send a response to the user, and emit some telemetry.
const respond = (span, config) => {
  console.log(config.trace)

  span.setStatus({
    code: config.code,
    message: config.trace
  });

  span.end();

  if (config.visibility !== null) {
    span.setAttribute('internal.visibility', config.visibility)
  }

  return new Response(
    config.response != null ? new Blob([ config.response ]) : null,
    { status: config.status }
  )
}

/* AST tools */

// Make a key for the cache. We just strip syntax locations and 
const makeCacheKey = abstractSyntaxTree => {
  const { directives, ... object } =
    abstractSyntaxTree.definitions[0]

  const filtered = directives.filter(directive =>
    directive.name.value == "cache")

  return JSON.stringify({ directives: filtered, ... object })
}

// Remove all locations from the AST. This makes the likelihood of a cache hit
// a little higher, because whitespace is no longer important.
const stripLocations = abstractSyntaxTree => {
  switch (typeof abstractSyntaxTree) {
    case 'object':
      delete abstractSyntaxTree.loc

      for (const key in abstractSyntaxTree) {
        stripLocations(abstractSyntaxTree[key])
      }
  }
}

// Check whether caching has been specifically disabled for this request.
const disabledCaching = abstractSyntaxTree =>
  abstractSyntaxTree.definitions[0]?.directives
    .some(directive => directive.name.value == "nocache")

// Check an AST to see whether caching has been requested.
// Returns either the caching directive or undefined.
const requestedCaching = abstractSyntaxTree =>
  abstractSyntaxTree.definitions[0]?.directives
    .find(directive => directive.name.value == "cached")

// Check an AST to see whether the user has explicitly requested that the
// cache be refreshed.
const forcedCacheRefresh = abstractSyntaxTree =>
  requestedCaching(abstractSyntaxTree)?.arguments
    .find(argument => argument.name.value == "refresh")
      ?.value.value

// Get the requested TTL for this request.
// Returns either the TTL or the user-set default.
const getCacheTTL = (env, abstractSyntaxTree) => {
  const requestedTTL
    = requestedCaching(abstractSyntaxTree)?.arguments
      .find(argument => argument.name.value == "ttl")

  const parsed: number = parseInt(requestedTTL?.value.value)
  return isNaN(parsed) ? env.CACHE_DEFAULT_TTL : parsed
}

/* TypeScript interfaces */

interface PreParsePluginRequest {
  rawRequest: {
    query: string,
    variables: { [string]: JSON },
    operationName: string | null
  }

  session: {
    role: string,
    variables: { [string]: string }
  }
}

interface PreResponsePluginRequest {
  rawRequest: {
    query: string,
    variables: { [string]: JSON },
    operationName: string | null
  },

  response: {
    data: JSON
  },

  session: {
    role: string,
    variables: { [string]: string }
  }
}
