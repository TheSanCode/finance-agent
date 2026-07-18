import { createApp } from "./app.js";
import { loadConfig } from "../../../packages/shared/src/config.js";
import { createLogger } from "../../../packages/shared/src/logger.js";

const config = loadConfig();
const logger = createLogger({ service: "finance-agent-api" });

const PORT = config.PORT;

const app = createApp();

app.listen(PORT, () => {
  logger.info("server.started", {
    port: PORT,
    environment: config.NODE_ENV
  });
});
