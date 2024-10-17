import { cachingHandler as handler } from './handler'

const storage = {};

// Check that a non-expired key exists in the cache.
const exists = (key: string) => {
  const now = Math.floor(new Date() / 1000);
  return key in storage && storage[key].expiry > now;
};

// An implementation of an in-memory cache.
export const cachingHandler = handler({
  write: (key: string, response: JSON, ttl) => {
    storage[key] = {
      response: JSON.stringify(response),
      expiry: ttl + Math.round(new Date() / 1000)
    }
  },

  read: (key: string) => {
    return exists(key)
      ? storage[key].response
      : null;
  },

  delete: (key: string) => {
    delete storage[key];
  },

  exists
})
