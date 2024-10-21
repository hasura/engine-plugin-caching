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

// We want to continue with Hasura engine execution.
export const continue_ = ({ attributes, message }) => {
  const tracing = { code: SpanStatusCode.OK, message };
  return { attributes, response: null, status: 204, tracing };
}

// We can respond immediately and skip Hasura engine execution.
export const respond = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.OK, message };
  return { attributes, response, status: 200, tracing };
}

// There was a user error.
export const userError = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.ERROR, message };
  return { attributes, response, status: 400, tracing };
}

// There was an internal error.
export const serverError = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.ERROR, message };
  return { attributes, response, status: 500, tracing };
}
