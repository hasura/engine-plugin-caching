import { Config } from '../config.js'
import { prepareRequest } from '../request.js'
import { lookupCacheEntry, shouldCache } from '../cache.js'

import preResponsePluginRequest from '../types/response.js'
import { respond, userError } from '../server/response.js'

export default async request => {
  const token = Config.headers['hasura-m-auth'];

  if (request.header('hasura-m-auth') != token) {
    return userError({
      attributes: {},
      response: { message: 'unauthorised request' },
      message: 'unauthorised request',
    })
  }

  const userResponse = preResponsePluginRequest.validate(request.body);

  if (userResponse.error != null) {
    return userError({
      attributes: { visibility: null },
      response: { message: 'bad request: ' + userResponse.error },
      message: 'bad request: ' + userResponse.error
    })
  }

  const { key, parsed } = prepareRequest(userResponse.value);

  if (!shouldCache(parsed)) {
    return respond({
      attributes: { visibility: 'user' },
      response: null,
      message: 'nothing saved to cache',
    })
  }

  const lookup = await lookupCacheEntry(key);

  if (lookup != null) {
    return respond({
      attributes: { visibility: 'user' },
      response: lookup.response,
      message: 'value already cached',
    })
  }

  await writeEntryToCache(key,
    userResponse.value.response,
    Config.timeToLive
  );

  return respond({
    attributes: { visibility: 'user' },
    response: userResponse.response,
    message: 'saved response to cache',
  })
}