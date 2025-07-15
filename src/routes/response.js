import { Config } from "../config.js";
import { addHeadersToRequest, prepareRequest } from "../request.js";
import { lookupCacheEntry, shouldCache, writeEntryToCache } from "../cache.js";

import preResponsePluginRequest from "../types/response.js";
import { respond, userError } from "../server/response.js";
import logger from "../logger.js";

export default async (request) => {
  const token = Config.headers["hasura-m-auth"];

  if (request.header("hasura-m-auth") != token) {
    logger.warn("Unauthorized pre-response request", {
      endpoint: "/pre-response",
      reason: "invalid_auth_header"
    });

    return userError({
      attributes: {},
      response: { message: "unauthorised request" },
      message: "unauthorised request",
    });
  }

  const userResponse = preResponsePluginRequest.validate(request.body);

  if (userResponse.error != null) {
    logger.warn("Invalid pre-response request", {
      endpoint: "/pre-response",
      validationError: userResponse.error.message
    });

    return userError({
      attributes: { "internal.visibility": null },
      response: { message: "bad request: " + userResponse.error },
      message: "bad request: " + userResponse.error,
    });
  }

  try {
    // Pass HTTP headers to the request for cache key generation
    const requestWithHeaders = addHeadersToRequest(userResponse.value, request.headers);

    const { key, parsed } = prepareRequest(requestWithHeaders);

    if (!shouldCache(parsed)) {
      logger.debug("Query not cacheable, skipping cache write", {
        endpoint: "/pre-response"
      });

      return respond({
        attributes: { "internal.visibility": "user" },
        message: "nothing saved to cache",
      });
    }

    const lookup = await lookupCacheEntry(key);

    if (lookup != null) {
      logger.debug("Response already cached", {
        endpoint: "/pre-response"
      });

      return respond({
        attributes: { "internal.visibility": "user" },
        message: "value already cached",
      });
    }

    await writeEntryToCache(key, parsed, userResponse.value.response);

    logger.info("Response cached successfully", {
      endpoint: "/pre-response"
    });

    return respond({
      attributes: { "internal.visibility": "user" },
      message: "saved response to cache",
    });
  } catch (error) {
    logger.error("Error processing pre-response request", {
      endpoint: "/pre-response",
      error: error
    });

    throw error;
  }
};
