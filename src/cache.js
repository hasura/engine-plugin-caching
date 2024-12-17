import { createClient } from "redis";

import { Config } from "./config.js";
import { stripLocations } from "./request.js";
import { parse } from "graphql";

// This will eventually house the ASTs of the queries we're going to cache.
// Note that we cache the query for every role and different set of session
// variables for now, as these coud produce different results.
let queriesToCache = null;

const client = await createClient({ url: Config.redis_url })
  .on("error", (err) => console.log("Client error", err))
  .connect();

// Write an entry to the configured Redis cache. These will be written
export const writeEntryToCache = async (key, parsed, value) => {
  initialise();

  const ttl = queriesToCache[JSON.stringify(parsed)]
  await client.set(key, JSON.stringify(value), { EX: ttl })
};

// Look up an entry in the Redis cache.
export const lookupCacheEntry = async (key) => {
  initialise();
  return await client.get(key);
};

// Check whether the given query should be cached. To do this, we produce the
// stringified AST, and we check whether that matches another stringified AST
// that we've marked as a request we should cache.
export const shouldCache = (parsed) => {
  initialise();

  const key = JSON.stringify(parsed);
  return key in queriesToCache;
};

// To do the lookup in the list of queries we want to cache, we first create
// the ASTs for the queries we want to cache, and then stringify them so we can
// do object equality more directly (i.e. by string equality). This could be
// made much more sophisticated if the need arose.
const initialise = () => {
  if (queriesToCache == null) {
    queriesToCache = [];

    Config.queries_to_cache.forEach(({ query, time_to_live }) => {
      const parsed = parse(query);
      stripLocations(parsed);

      queriesToCache[JSON.stringify(parsed)] = time_to_live;
    });

    console.log(queriesToCache)
  }
};
