import { Config } from "../config.js";
import { prepareRequest } from "../request.js";
import { lookupCacheEntry, shouldCache } from "../cache.js";

import preParsePluginRequest from "../types/parse.js";
import { continue_, respond, userError } from "../server/response.js";

export default async (request) => {
  const token = Config.headers["hasura-m-auth"];

  if (request.header("hasura-m-auth") != token) {
    return userError({
      attributes: {},
      response: { message: "unauthorised request" },
      message: "unauthorised request",
    });
  }

  const userRequest = preParsePluginRequest.validate(request.body);

  if (userRequest.error != null) {
    return userError({
      attributes: { visibility: null },
      response: { message: "bad request: " + userRequest.error },
      message: "bad request: " + userRequest.error,
    });
  }

  const { key, parsed } = prepareRequest(userRequest.value);

  if (!shouldCache(parsed)) {
    return continue_({
      attributes: { visibility: "user" },
      message: "query not listed as cacheable",
    });
  }

  const lookup = await lookupCacheEntry(key);

  if (lookup == null) {
    return continue_({
      attributes: { visibility: "user" },
      message: "found cacheable query with no current entry",
    });
  }

  return respond({
    attributes: { visibility: "user" },
    response: JSON.parse(lookup),
    message: "found query response in cache",
  });
};
