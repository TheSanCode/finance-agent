import { createApp, createAppDependencies } from "./app.js";
import {
  ApproveStatementImportUseCase,
  CategorizeImportedStatementUseCase,
  CategorizeTransactionUseCase,
  ConfirmTransactionCategoryUseCase,
  CorrectTransactionCategoryUseCase,
  CreateStatementImportPreviewUseCase,
  GetCreditCardSummaryUseCase,
  GetStatementImportPreviewUseCase,
  SuggestTransactionCategoryUseCase
} from "../../../packages/application/src/index.js";
import {
  CsvStatementExtractor,
  FirebaseAuthService,
  FirestoreAuditTrailRepository,
  FirestoreCategorizationIdempotencyRepository,
  FirestoreCategorizationRuleRepository,
  FirestoreCreditCardAccountReadRepository,
  FirestoreImportedTransactionRepository,
  FirestorePostedTransactionFingerprintReadRepository,
  FirestoreStatementImportPreviewRepository,
  FirestoreTransactionRepository,
  GeminiCategorySuggestionProvider
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
const transactionRepository = new FirestoreTransactionRepository();
const categorizationRuleRepository = new FirestoreCategorizationRuleRepository();
const categorySuggestionProvider = new GeminiCategorySuggestionProvider();
const categorizationIdempotencyRepository = new FirestoreCategorizationIdempotencyRepository();

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
const categorizeTransactionUseCase = new CategorizeTransactionUseCase({
  transactionRepository,
  categorizationRuleRepository,
  idempotencyRepository: categorizationIdempotencyRepository,
  auditTrailRepository
});
const suggestTransactionCategoryUseCase = new SuggestTransactionCategoryUseCase({
  transactionRepository,
  categorizationRuleRepository,
  categorySuggestionProvider,
  idempotencyRepository: categorizationIdempotencyRepository,
  auditTrailRepository
});
const confirmTransactionCategoryUseCase = new ConfirmTransactionCategoryUseCase({
  transactionRepository,
  idempotencyRepository: categorizationIdempotencyRepository,
  auditTrailRepository
});
const correctTransactionCategoryUseCase = new CorrectTransactionCategoryUseCase({
  transactionRepository,
  categorizationRuleRepository,
  idempotencyRepository: categorizationIdempotencyRepository,
  auditTrailRepository
});
const categorizeImportedStatementUseCase = new CategorizeImportedStatementUseCase({
  transactionRepository,
  idempotencyRepository: categorizationIdempotencyRepository,
  categorizeTransactionUseCase
});

const PORT = config.PORT;

const app = createApp(
  createAppDependencies({
    authService,
    getCreditCardSummaryUseCase,
    createStatementImportPreviewUseCase,
    getStatementImportPreviewUseCase,
    approveStatementImportUseCase,
    categorizeTransactionUseCase,
    suggestTransactionCategoryUseCase,
    confirmTransactionCategoryUseCase,
    correctTransactionCategoryUseCase,
    categorizeImportedStatementUseCase,
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
