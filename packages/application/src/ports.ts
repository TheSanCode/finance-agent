import { type Money } from "../../domain/src/money.js";
import { type CreditCardAccount } from "../../domain/src/credit-card-summary.js";
import {
  type NormalizedStatementTransaction,
  type StatementImportPreview,
  type StatementImportStatus
} from "../../domain/src/statement-import.js";
import {
  type CategorizableTransaction,
  type CategorizationRule,
  type CategorizationSource,
  type Category
} from "../../domain/src/transaction-categorization.js";

export type ApprovalRequest = {
  readonly operation: "create-journal-entry";
  readonly reason: string;
  readonly requestedBy: string;
};

export interface ApprovalPort {
  requestHumanApproval(input: ApprovalRequest): Promise<{ approved: boolean; approverId?: string }>;
}

export type LedgerEntryDraft = {
  readonly accountId: string;
  readonly amount: Money;
  readonly description: string;
};

export interface LedgerRepository {
  saveEntry(input: LedgerEntryDraft): Promise<{ id: string }>;
}

export interface CreditCardAccountReadRepository {
  findByAccountIdForUser(input: {
    accountId: string;
    ownerUserId: string;
  }): Promise<CreditCardAccount | null>;
}

export type StatementUploadFile = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly content: Buffer;
};

export type ExtractedStatementRow = {
  readonly rowNumber: number;
  readonly occurredOn: string;
  readonly description: string;
  readonly amountMinor: string;
  readonly currency: string;
};

export type ExtractedStatement = {
  readonly rows: ReadonlyArray<ExtractedStatementRow>;
  readonly statementTotalMinor?: string;
};

export interface StatementExtractor {
  extract(file: StatementUploadFile): Promise<ExtractedStatement>;
}

export interface StatementImportPreviewRepository {
  create(preview: StatementImportPreview): Promise<StatementImportPreview>;
  findByIdForUser(input: {
    previewId: string;
    ownerUserId: string;
  }): Promise<StatementImportPreview | null>;
  updateStatus(input: {
    previewId: string;
    status: StatementImportStatus;
    approvedBy?: string;
    approvedAt?: string;
    importedAt?: string;
  }): Promise<StatementImportPreview>;
  findApprovalByIdempotencyKey(input: {
    previewId: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<{ importedCount: number; importedAt: string } | null>;
  saveApprovalIdempotencyKey(input: {
    previewId: string;
    actorId: string;
    idempotencyKey: string;
    importedCount: number;
    importedAt: string;
  }): Promise<void>;
}

export interface PostedTransactionFingerprintReadRepository {
  listForAccount(accountId: string): Promise<ReadonlyArray<string>>;
}

export interface ImportedTransactionRepository {
  importApprovedRows(input: {
    previewId: string;
    accountId: string;
    actorId: string;
    rows: ReadonlyArray<NormalizedStatementTransaction>;
    importedAt: string;
  }): Promise<{ importedCount: number }>;
}

export interface AuditTrailRepository {
  record(input: {
    accountId: string;
    actorId: string;
    action: string;
    timestamp: string;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void>;
}

export type TransactionCategorizationUpdate = {
  readonly category: Category;
  readonly source: CategorizationSource;
  readonly confidence: number;
  readonly explanation: string;
  readonly ruleId?: string;
  readonly confirmed: boolean;
};

export interface TransactionRepository {
  findByIdForUser(input: {
    transactionId: string;
    ownerUserId: string;
  }): Promise<CategorizableTransaction | null>;
  listByImportIdForUser(input: {
    importId: string;
    ownerUserId: string;
  }): Promise<ReadonlyArray<CategorizableTransaction>>;
  saveCategorization(input: {
    transactionId: string;
    ownerUserId: string;
    update: TransactionCategorizationUpdate;
  }): Promise<void>;
}

export interface CategorizationRuleRepository {
  listByOwnerUserId(ownerUserId: string): Promise<ReadonlyArray<CategorizationRule>>;
  upsert(rule: CategorizationRule): Promise<void>;
}

export interface CategorySuggestionProvider {
  suggest(input: {
    transaction: CategorizableTransaction;
    allowedCategories: ReadonlyArray<Category>;
  }): Promise<{
    category: Category;
    confidence: number;
    rationale: string;
  } | null>;
}

export interface CategorizationIdempotencyRepository {
  findResult(input: {
    operation: string;
    targetId: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<Record<string, unknown> | null>;
  saveResult(input: {
    operation: string;
    targetId: string;
    actorId: string;
    idempotencyKey: string;
    createdAt: string;
    response: Record<string, unknown>;
  }): Promise<void>;
}
