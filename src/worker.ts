import { trace } from "@opentelemetry/api";
import { cachingHandler } from "./in-memory";
import { instrument, ResolveConfigFn } from "@microlabs/otel-cf-workers";

const handler = {
  async fetch(request, env, ctx) {
    trace.getActiveSpan()?.setAttribute("internal.visibility", String("user"));
    return cachingHandler(env, request);
  },
};

const resolveConfig: ResolveConfigFn = (env, _trigger) => ({
  exporter: {
    url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: {
      Authorization: `pat ${env.OTEL_EXPORTER_PAT}`,
    },
  },

  service: {
    name: "caching-plugin"
  },
})

export default instrument(handler, resolveConfig);
