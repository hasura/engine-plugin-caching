import { createClient } from 'redis';

import { Config } from "./config.js";
import { stripLocations } from "./request.js"
import { parse } from "graphql";

let queriesToCache = null;

const client = await createClient({ url: Config.redis_url })
  .on('error', err => console.log('Client error', err))
  .connect();

export const generateKey = parsed => JSON.stringify(parsed);

export const writeEntryToCache = (key, value, ttl) => {
  initialise();
  client.set(key, JSON.stringify(value), 'EX', Config.timeToLive)
}

export const lookupCacheEntry = key => {
  initialise();
  return client.get(key)
};

export const shouldCache = parsed => {
  initialise();

  const key = JSON.stringify(parsed);
  return queriesToCache.indexOf(key) != -1
}

const initialise = () => {
  if (queriesToCache == null) {
    queriesToCache = [];

    Config.queriesToCache.forEach(query => {
      const parsed = parse(query);
      stripLocations(parsed);

      queriesToCache.push(JSON.stringify(parsed));
    })
  }
}
