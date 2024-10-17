import { SpanStatusCode } from "@opentelemetry/api";

// Pre-parse/pre-response: everything is fine, continue execution.
export const continue_ = ({ attributes, message }) => {
  const tracing = { code: SpanStatusCode.OK, message };
  return { attributes, response: null, status: 204, tracing };
};

// Pre-parse: skip further execution, return the given value instead.
export const respond = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.OK, message };
  return { attributes, response, status: 200, tracing };
};

// Pre-parse/pre-response: a user-caused error occurred.
export const userError = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.ERROR, message };
  return { attributes, response, status: 400, tracing };
};

// Pre-parse/pre-response: a server-caused error occurred.
export const serverError = ({ attributes, response, message }) => {
  const tracing = { code: SpanStatusCode.ERROR, message };
  return { attributes, response, status: 500, tracing };
};
