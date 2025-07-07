import express from "express";
import serverless from "serverless-http";

import { withTrace } from "./server/control.js";
import preParseLifecycleHook from "./routes/parse.js";
import preResponseLifecycleHook from "./routes/response.js";
import tracer from "./tracing.js";
import logger from "./logger.js";

export const app = express();
app.use(express.json({limit: "50mb"}));

// Log application startup
logger.info("Caching plugin starting up", {
  nodeVersion: process.version,
  logLevel: process.env.LOG_LEVEL || 'INFO'
});

app.get("/health", (_req, res) => {
  logger.debug("Health check requested");
  res.status(200).json({ status: "healthy" });
});

app.post("/pre-parse", withTrace(tracer, "pre-parse", preParseLifecycleHook));
app.post(
  "/pre-response",
  withTrace(tracer, "pre-response", preResponseLifecycleHook),
);

export const handler = serverless(app);
