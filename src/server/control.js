import { SpanStatusCode } from '@opentelemetry/api';

// Wrap a request handler with tracing.
export const withTrace = (tracer, label, handler) => (req, res) => {
  return tracer.startActiveSpan(label, async span => {
    const { attributes, response, status, tracing } = await handler(req);
    console.log(tracing.message);

    span.setStatus(tracing);
    span.end();

    for (let [ key, value ] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }

    res.status(status);
    res.json(response);
  })
}
