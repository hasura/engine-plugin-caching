import { app } from "./src/index.js";
import logger from "./src/logger.js";

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  logger.info("Caching plugin server started", {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development'
  });
});
