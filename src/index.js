import express from 'express';
import { parse } from 'graphql';
import { trace } from '@opentelemetry/api';
import serverless from 'serverless-http';

import * as control from './server/control.js';
import { Config } from './config.js'
import { generateKey, lookupCacheEntry, shouldCache, writeEntryToCache } from './cache.js';
import { preParsePluginRequest, preResponsePluginRequest } from './server/types.js';
import { prepareRequest } from './utilities.js';

const tracer = trace.getTracer("engine-plugin-caching");

export const app = express();
app.use(express.json());

/* --- Routes --- */

// Pre-parse (cache reading) phase
app.get('/pre-parse', control.withTrace(tracer, 'pre-parse', async request => {
  const token = Config.headers['hasura-m-auth'];

  if (request.header('hasura-m-auth') != token) {
    return control.userError({
      attributes: {},
      response: { message: 'unauthorised request' },
      message: 'unauthorised request',
    })
  }

  const userRequest = preParsePluginRequest.validate(request.body);

  if (userRequest.error != null) {
    return control.userError({
      attributes: { visibility: null },
      response: { message: 'bad request: ' + userRequest.error },
      message: 'bad request: ' + userRequest.error
    })
  }

  const { key, parsed } = prepareRequest(userRequest.value)

  if (!shouldCache(parsed)) {
    return control.continue_({
      attributes: { visibility: 'user' },
      message: 'query not listed as cacheable',
    })
  }

  const lookup = await lookupCacheEntry(key);

  if (lookup == null) {
    return control.continue_({
      attributes: { visibility: 'user' },
      message: 'found cacheable query with no current entry',
    })
  }

  return control.respond({
    attributes: { visibility: 'user' },
    response: lookup,
    message: 'found query response in cache',
  })
}))

// Pre-response (cache writing) phase
app.get('/pre-response', control.withTrace(tracer, 'pre-response', async request => {
  const token = Config.headers['hasura-m-auth'];

  if (request.header('hasura-m-auth') != token) {
    return control.userError({
      attributes: {},
      response: { message: 'unauthorised request' },
      message: 'unauthorised request',
    })
  }

  const userResponse = preResponsePluginRequest.validate(request.body);

  if (userResponse.error != null) {
    return control.userError({
      attributes: { visibility: null },
      response: { message: 'bad request: ' + userResponse.error },
      message: 'bad request: ' + userResponse.error
    })
  }

  const { key, parsed } = prepareRequest(userResponse.value);

  if (!shouldCache(parsed)) {
    return control.respond({
      attributes: { visibility: 'user' },
      response: null,
      message: 'nothing saved to cache',
    })
  }

  const lookup = await lookupCacheEntry(key);

  if (lookup != null) {
    return control.respond({
      attributes: { visibility: 'user' },
      response: lookup.response,
      message: 'value already cached',
    })
  }

  await writeEntryToCache(key,
    userResponse.value.response,
    Config.timeToLive
  );

  return control.respond({
    attributes: { visibility: 'user' },
    response: userResponse.response,
    message: 'saved response to cache',
  })
}))

/* --- Bootstrapping for local and production work --- */

// For running on Lambda or similiar.
export const handler = serverless(app)

// For running locally.
app.listen(8787, () => {
  console.log('Up and running')
})
