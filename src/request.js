import { parse } from "graphql";
import { Config } from "./config.js";
import logger from "./logger.js";

// Parse a request to convert the request into an AST, and then use that AST
// and the other information to produce a cache key.
export const prepareRequest = (request) => {
  const { query } = request.rawRequest;
  const parsed = parse(query);
  stripLocations(parsed);

  const key = generateCacheKey(request, Config.cache_key);
  return { parsed, key };
};

// Generate a cache key based on configuration and request data
export const generateCacheKey = (request, cache_key_config) => {
  // Extract the components from the request that were previously passed as separate parameters
  const { query, operationName, ...req } = request.rawRequest;
  const parsed = parse(query);
  stripLocations(parsed);
  var key_components = {}

  if (cache_key_config){
    if (cache_key_config.rawRequest){
      var rawRequest = {};
      if (cache_key_config.rawRequest.query){
        // Use the same format as the original implementation to maintain compatibility
        rawRequest.query = parsed;
        // Include all remaining request properties to match original behavior
        Object.assign(rawRequest, req);
      }
      if (cache_key_config.rawRequest.operationName){
        rawRequest.operationName = operationName;
      }
      if (cache_key_config.rawRequest.variables){
        rawRequest.variables = req.variables;
      }
      if (Object.keys(rawRequest).length > 0){
        key_components.rawRequest = rawRequest;
      }
    }
    if (cache_key_config.session === true){
      key_components.session = request.session;
    }
    
    if (cache_key_config.headers){
      var headers = {};
      cache_key_config.headers.forEach(header => {
        let lowerHeader = header.toLowerCase();
        if (request.headers[lowerHeader] === undefined) {
          logger.error("Required header for cache key is missing", {
            missingHeader: lowerHeader,
            availableHeaders: request.headers ? Object.keys(request.headers) : []
          });
          throw new Error(`Required header '${header}' for cache key is missing from request`);
        }
        headers[lowerHeader] = request.headers[lowerHeader];
      });
      if (Object.keys(headers).length > 0){
        key_components.headers = headers;
      }
    }
  } else {
    key_components = {
      rawRequest: { query: parsed, ...req },
      session: request.session,
    };
  }

  return JSON.stringify(key_components);
};

// The AST parsed by the `graphql` package contains location information from
// the original file. We strip all this as we want our caching to be
// independent of whitespace.
export const stripLocations = (abstractSyntaxTree) => {
  switch (typeof abstractSyntaxTree) {
    case "object":
      delete abstractSyntaxTree.loc;

      for (const key in abstractSyntaxTree) {
        stripLocations(abstractSyntaxTree[key]);
      }
  }
};
