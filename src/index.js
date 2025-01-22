import express from "express";
import { trace } from "@opentelemetry/api";
import serverless from "serverless-http";

import { withTrace } from "./server/control.js";
import preParseLifecycleHook from "./routes/parse.js";
import preResponseLifecycleHook from "./routes/response.js";
import tracer from "./tracing.js";

export const app = express();
app.use(express.json({limit: "50mb"}));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.post("/pre-parse", withTrace(tracer, "pre-parse", preParseLifecycleHook));
app.post(
  "/pre-response",
  withTrace(tracer, "pre-response", preResponseLifecycleHook),
);

export const handler = serverless(app);
