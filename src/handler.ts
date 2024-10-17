import { Config } from "./config";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { parse } from "graphql";

const tracer = trace.getTracer("caching-plugin")
const storage: { [string]: { response: string, expiry: number } } = {}
const queriesToCache = []

// A pre-parse and pre-response plugin handler for caching Hasura requests.
export const cachingHandler = impl => async request => {
  return tracer.startActiveSpan('Caching plugin', async span => {
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

    Config.queriesToCache.forEach(query => {
      const parsed = parse(query);
      stripLocations(parsed);

      queriesToCache.push(JSON.stringify(parsed));
    })

    const phase: string | null =
      request.headers?.get('hasura-plugin-phase')

    switch (phase) {
      case 'pre-parse':
        return preParseHandler(span, impl, request)

      case 'pre-response':
        return preResponseHandler(span, impl, request)

      default:
        return respond(span, {
          code: SpanStatusCode.ERROR,
          trace: 'unrecognised phase',
          visibility: null,
          response: { message: 'unrecognised phase: ' + phase },
          status: 500
        })
    }
  })
}

// A pre-parse handler for caching Hasura requests. This half is in charge of
// looking up a request in the cache, and determining whether or not to
// continue executing.
export const preParseHandler = async (span, impl, request) => {
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

  const { parsed, key } = prepare(rawRequest);

  if (shouldCache(parsed)) {
    if (await impl.exists(key)) {
      return respond(span, {
        code: SpanStatusCode.OK,
        trace: 'found query response in cache',
        visibility: 'user',
        response: await impl.read(key),
        status: 200
      })
    }

    return respond(span, {
      code: SpanStatusCode.OK,
      trace: 'found cacheable query with no current entry',
      visibility: 'user',
      response: undefined,
      status: 204
    })
  }

  return respond(span, {
    code: SpanStatusCode.OK,
    trace: 'query not listed as cacheable',
    visibility: 'user',
    response: null,
    status: 204
  })
}

// A pre-response handler for caching Hasura requests. This half is in charge
// of storing a response in the cache according to the caching configuration.
export const preResponseHandler = async (span, impl, request) => {
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

  const { parsed, key } = prepare(rawResponse);

  if (shouldCache(parsed)) {
    if (await impl.exists(key)) {
      return respond(span, {
        code: SpanStatusCode.OK,
        trace: 'value already cached',
        visibility: 'user',
        response: rawResponse.response,
        status: 200
      })
    }

    await impl.write(key, rawResponse.response, Config.timeToLive);

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

/* Helpers */

// Check whether the given value should be cached.
const shouldCache = parsed => {
  const key = JSON.stringify(parsed);
  return queriesToCache.indexOf(key) != -1
}

// Convert a query to an AST and a caching key.
const prepare = request => {
  const { query, ... req } = request.rawRequest;
  const parsed = parse(query);
  stripLocations(parsed);

  const key = JSON.stringify({
    rawRequest: { query: parsed, ... req },
    session: request.session
  });

  return { parsed, key };
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
