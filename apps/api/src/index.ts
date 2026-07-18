import { createApp, createAppDependencies } from "./app.js";
import {
  ApproveStatementImportUseCase,
  CreateStatementImportPreviewUseCase,
  GetCreditCardSummaryUseCase,
  GetStatementImportPreviewUseCase
} from "../../../packages/application/src/index.js";
import {
  CsvStatementExtractor,
  FirebaseAuthService,
  FirestoreAuditTrailRepository,
  FirestoreCreditCardAccountReadRepository,
  FirestoreImportedTransactionRepository,
  FirestorePostedTransactionFingerprintReadRepository,
  FirestoreStatementImportPreviewRepository
} from "../../../packages/infrastructure/src/index.js";
import { loadConfig } from "../../../packages/shared/src/config.js";
import { createLogger } from "../../../packages/shared/src/logger.js";

const config = loadConfig();
const logger = createLogger({ service: "finance-agent-api" });
const authService = new FirebaseAuthService();
const accountReadRepository = new FirestoreCreditCardAccountReadRepository();
const statementExtractor = new CsvStatementExtractor();
const previewRepository = new FirestoreStatementImportPreviewRepository();
const postedFingerprintRepository = new FirestorePostedTransactionFingerprintReadRepository();
const importedTransactionRepository = new FirestoreImportedTransactionRepository();
const auditTrailRepository = new FirestoreAuditTrailRepository();

const getCreditCardSummaryUseCase = new GetCreditCardSummaryUseCase(accountReadRepository);
const createStatementImportPreviewUseCase = new CreateStatementImportPreviewUseCase({
  accountReadRepository,
  statementExtractor,
  previewRepository,
  postedFingerprintRepository,
  auditTrailRepository,
  maxFileSizeBytes: config.STATEMENT_MAX_FILE_SIZE_BYTES
});
const getStatementImportPreviewUseCase = new GetStatementImportPreviewUseCase(previewRepository);
const approveStatementImportUseCase = new ApproveStatementImportUseCase({
  previewRepository,
  importedTransactionRepository,
  auditTrailRepository
});

const PORT = config.PORT;

const app = createApp(
  createAppDependencies({
    authService,
    getCreditCardSummaryUseCase,
    createStatementImportPreviewUseCase,
    getStatementImportPreviewUseCase,
    approveStatementImportUseCase,
    statementMaxFileSizeBytes: config.STATEMENT_MAX_FILE_SIZE_BYTES,
    logger
  })
);

app.listen(PORT, () => {
  logger.info("server.started", {
    port: PORT,
    environment: config.NODE_ENV
  });
});
