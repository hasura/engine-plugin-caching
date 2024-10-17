# Client-side caching

## Cache a query

```
query @cached { ... }
```

## Cache a query with a custom TTL (seconds)

```
query @cached(ttl: 60) { ... }
```

## Override the value in the cache

```
query @cached(ttl: 60, refresh: true) { ... }
```

## Skip the cache entirely

```
query @nocache { ... }
```
