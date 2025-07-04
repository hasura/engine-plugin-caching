import { Config } from "../config.js";
import { prepareRequest } from "../request.js";
import { lookupCacheEntry, shouldCache } from "../cache.js";

import preParsePluginRequest from "../types/parse.js";
import { continue_, respond, userError } from "../server/response.js";
import logger from "../logger.js";

export default async (request) => {
  const token = Config.headers["hasura-m-auth"];

  if (request.header("hasura-m-auth") != token) {
    logger.warn("Unauthorized pre-parse request", {
      endpoint: "/pre-parse",
      reason: "invalid_auth_header"
    });

    return userError({
      attributes: {},
      response: { message: "unauthorised request" },
      message: "unauthorised request",
    });
  }

  const userRequest = preParsePluginRequest.validate(request.body);

  if (userRequest.error != null) {
    logger.warn("Invalid pre-parse request", {
      endpoint: "/pre-parse",
      validationError: userRequest.error.message
    });

    return userError({
      attributes: { visibility: null },
      response: { message: "bad request: " + userRequest.error },
      message: "bad request: " + userRequest.error,
    });
  }

  try {
    const { key, parsed } = prepareRequest(userRequest.value);

    if (!shouldCache(parsed)) {
      logger.debug("Query not cacheable", {
        endpoint: "/pre-parse"
      });

      return continue_({
        attributes: { visibility: "user" },
        message: "query not listed as cacheable",
      });
    }

    const lookup = await lookupCacheEntry(key);

    if (lookup == null) {
      logger.debug("Cache miss for cacheable query", {
        endpoint: "/pre-parse"
      });

      return continue_({
        attributes: { visibility: "user" },
        message: "found cacheable query with no current entry",
      });
    }

    logger.info("Cache hit", {
      endpoint: "/pre-parse"
    });

    return respond({
      attributes: { visibility: "user" },
      response: JSON.parse(lookup),
      message: "found query response in cache",
    });
  } catch (error) {
    logger.error("Error processing pre-parse request", {
      endpoint: "/pre-parse",
      error: error
    });

    throw error;
  }
};
