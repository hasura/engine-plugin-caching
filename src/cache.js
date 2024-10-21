import { Config } from "./config.js";
import { parse, stripLocations } from "./utilities.js"

const storage = {};
let queriesToCache = null;

export const generateKey = parsed => JSON.stringify(parsed);

export const writeEntryToCache = (key, value, ttl) => {
  console.log({ key, storage })
  storage[key] = {
    response: JSON.stringify(value),
    expiry: ttl + Math.round(new Date() / 1000)
  }
}

export const cacheEntryExists = key => {
  initialise()

  const now = Math.floor(new Date() / 1000);
  return key in storage && storage[key].expiry > now;
};

export const lookupCacheEntry = key => {
  initialise()
  console.log({ key, storage })

  return cacheEntryExists(key)
    ? storage[key].response
    : null;
};

export const shouldCache = parsed => {
  initialise()

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
