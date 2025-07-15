import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import {
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator
} from "@opentelemetry/core";
import { B3Propagator, B3InjectEncoding } from "@opentelemetry/propagator-b3";

import { trace, propagation } from "@opentelemetry/api";
import { Config } from "./config.js";

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "engine-plugin-caching",
  }),
});

const traceExporter = new OTLPTraceExporter({
  url: Config.otel_endpoint,
  headers: Config.otel_headers,
});

provider.addSpanProcessor(new SimpleSpanProcessor(traceExporter));
provider.register();

// Configure propagators to support both W3C Trace Context and B3 formats
propagation.setGlobalPropagator(
  new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(), // For traceparent/tracestate headers
      new W3CBaggagePropagator(),      // For baggage headers
      new B3Propagator(),              // For B3 multi-header format
      new B3Propagator({
        injectEncoding: B3InjectEncoding.SINGLE_HEADER
      })                               // For B3 single-header format
    ],
  })
);

// Register HTTP instrumentation to automatically propagate context
registerInstrumentations({ instrumentations: [new HttpInstrumentation()]});

export default trace.getTracer("engine-plugin-caching");
