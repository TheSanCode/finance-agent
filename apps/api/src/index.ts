import { createApp, createAppDependencies } from "./app.js";
import { GetCreditCardSummaryUseCase } from "../../../packages/application/src/index.js";
import {
  FirebaseAuthService,
  FirestoreCreditCardAccountReadRepository
} from "../../../packages/infrastructure/src/index.js";
import { loadConfig } from "../../../packages/shared/src/config.js";
import { createLogger } from "../../../packages/shared/src/logger.js";

const config = loadConfig();
const logger = createLogger({ service: "finance-agent-api" });
const authService = new FirebaseAuthService();
const readRepository = new FirestoreCreditCardAccountReadRepository();
const getCreditCardSummaryUseCase = new GetCreditCardSummaryUseCase(readRepository);

const PORT = config.PORT;

const app = createApp(
  createAppDependencies({
    authService,
    getCreditCardSummaryUseCase,
    logger
  })
);

app.listen(PORT, () => {
  logger.info("server.started", {
    port: PORT,
    environment: config.NODE_ENV
  });
});
