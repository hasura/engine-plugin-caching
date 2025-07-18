import { SpanStatusCode, context, propagation } from "@opentelemetry/api";
import logger from "../logger.js";



// Wrap a request handler with tracing. The handler then returns an object
// containing tracing attributes, the HTTP response, an HTTP status, and a
// message/status object to write to tracing.
export const withTrace = (tracer, label, handler) => (req, res) => {
  const startTime = Date.now();

  // Extract trace context from incoming HTTP headers
  const parentContext = propagation.extract(context.active(), req.headers);

  // Start span with the extracted parent context
  return context.with(parentContext, () => {
    return tracer.startActiveSpan(label, async (span) => {
    try {
      const { attributes, response, status, tracing } = await handler(req);
      const duration = Date.now() - startTime;

      // Log the HTTP request with structured data
      logger.logHttpRequest(req.method, req.path, status, {
        userAgent: req.get('User-Agent'),
        duration: duration,
        traceMessage: tracing.message
      });

      for (let [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      span.setStatus(tracing);
      span.end();

      res.status(status);
      res.json(response);

      const carrier = {};
      propagation.inject(context.active(), carrier);
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error("Request handler error", {
        method: req.method,
        path: req.path,
        duration: duration,
        error: error
      });

      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();

      res.status(500);
      res.json({ message: "Internal server error" });
    }
    });
  });
};
