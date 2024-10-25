import { SpanStatusCode } from '@opentelemetry/api';

export const continue_ = ({ attributes, message }) => {
  const tracing = { code: SpanStatusCode.OK, message };
  return { attributes, response: null, status: 204, tracing };
}

export const respond = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.OK, message };
  return { attributes, response, status: 200, tracing };
}

export const userError = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.ERROR, message };
  return { attributes, response, status: 400, tracing };
}

export const serverError = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.ERROR, message };
  return { attributes, response, status: 500, tracing };
}
