import { randomUUID } from "node:crypto";

import { ZodError, z } from "zod";

import {
  calculateStatementTotalMinor,
  createNormalizedTransaction,
  detectDuplicateFingerprints,
  type NormalizedStatementTransaction,
  type StatementDuplicateCandidate,
  type StatementImportPreview,
  type StatementImportWarning,
  type StatementRejectedRow
} from "../../domain/src/statement-import.js";
import {
  NotFoundApplicationError,
  PayloadTooLargeApplicationError,
  UnsupportedMediaTypeApplicationError,
  ValidationApplicationError
} from "./application-error.js";
import {
  type AuditTrailRepository,
  type CreditCardAccountReadRepository,
  type PostedTransactionFingerprintReadRepository,
  type StatementExtractor,
  type StatementImportPreviewRepository,
  type StatementUploadFile
} from "./ports.js";

export const createStatementImportPreviewInputSchema = z.object({
  accountId: z.string().min(1),
  authenticatedUserId: z.string().min(1),
  file: z.object({
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    content: z.instanceof(Buffer)
  })
});

export type CreateStatementImportPreviewInput = z.infer<
  typeof createStatementImportPreviewInputSchema
>;

type UseCaseDependencies = {
  accountReadRepository: CreditCardAccountReadRepository;
  statementExtractor: StatementExtractor;
  previewRepository: StatementImportPreviewRepository;
  postedFingerprintRepository: PostedTransactionFingerprintReadRepository;
  auditTrailRepository: AuditTrailRepository;
  maxFileSizeBytes: number;
  allowedMimeTypes?: ReadonlyArray<string>;
  now?: () => Date;
  createId?: () => string;
};

const rowSchema = z.object({
  rowNumber: z.number().int().positive(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  amountMinor: z.string().regex(/^-?\d+$/),
  currency: z.string().length(3)
});

const normalizeRows = (input: {
  accountId: string;
  rows: ReadonlyArray<{
    rowNumber: number;
    occurredOn: string;
    description: string;
    amountMinor: string;
    currency: string;
  }>;
}): {
  accepted: ReadonlyArray<NormalizedStatementTransaction>;
  rejected: ReadonlyArray<StatementRejectedRow>;
} => {
  const accepted: NormalizedStatementTransaction[] = [];
  const rejected: StatementRejectedRow[] = [];

  for (const row of input.rows) {
    const parsedRow = rowSchema.safeParse(row);

    if (!parsedRow.success) {
      rejected.push({ rowNumber: row.rowNumber, reason: "invalid_row_format" });
      continue;
    }

    try {
      accepted.push(
        createNormalizedTransaction({
          accountId: input.accountId,
          rowNumber: parsedRow.data.rowNumber,
          occurredOn: parsedRow.data.occurredOn,
          description: parsedRow.data.description,
          amountMinor: BigInt(parsedRow.data.amountMinor),
          currency: parsedRow.data.currency
        })
      );
    } catch {
      rejected.push({ rowNumber: row.rowNumber, reason: "invalid_row_value" });
    }
  }

  return { accepted, rejected };
};

export class CreateStatementImportPreviewUseCase {
  private readonly allowedMimeTypes: ReadonlyArray<string>;

  constructor(private readonly dependencies: UseCaseDependencies) {
    this.allowedMimeTypes = dependencies.allowedMimeTypes ?? [
      "text/csv",
      "application/vnd.ms-excel",
      "text/plain"
    ];
  }

  async execute(input: CreateStatementImportPreviewInput): Promise<StatementImportPreview> {
    let parsed: CreateStatementImportPreviewInput;

    try {
      parsed = createStatementImportPreviewInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid statement preview request");
      }
      throw error;
    }

    const account = await this.dependencies.accountReadRepository.findByAccountIdForUser({
      accountId: parsed.accountId,
      ownerUserId: parsed.authenticatedUserId
    });

    if (!account) {
      throw new NotFoundApplicationError("Credit card account not found");
    }

    this.validateFile(parsed.file);

    const extracted = await this.dependencies.statementExtractor.extract(
      parsed.file as StatementUploadFile
    );
    const normalized = normalizeRows({ accountId: parsed.accountId, rows: extracted.rows });

    const statementDuplicates = detectDuplicateFingerprints(normalized.accepted);
    const alreadyPosted = await this.dependencies.postedFingerprintRepository.listForAccount(
      parsed.accountId
    );
    const postedSet = new Set(alreadyPosted);

    const postedDuplicates: StatementDuplicateCandidate[] = normalized.accepted
      .filter((row) => postedSet.has(row.fingerprint))
      .map((row) => ({
        fingerprint: row.fingerprint,
        rowNumbers: [row.rowNumber],
        reason: "already_posted"
      }));

    const warnings: StatementImportWarning[] = [];
    const calculatedTotalMinor = calculateStatementTotalMinor(normalized.accepted).toString();

    let totalsValid = true;

    if (!extracted.statementTotalMinor) {
      warnings.push({
        code: "totals_missing",
        message: "Statement did not provide totals; manual review recommended"
      });
    } else if (extracted.statementTotalMinor !== calculatedTotalMinor) {
      totalsValid = false;
      warnings.push({
        code: "totals_mismatch",
        message: "Provided statement total does not match calculated row total"
      });
    }

    const nowIso = (this.dependencies.now ?? (() => new Date()))().toISOString();
    const previewId = (this.dependencies.createId ?? randomUUID)();

    const preview: StatementImportPreview = {
      previewId,
      accountId: parsed.accountId,
      ownerUserId: parsed.authenticatedUserId,
      status: "PENDING_APPROVAL",
      sourceFileName: parsed.file.fileName,
      createdAt: nowIso,
      rows: normalized.accepted,
      rejectedRows: normalized.rejected,
      duplicateCandidates: [...statementDuplicates, ...postedDuplicates],
      warnings,
      totals: {
        calculatedTotalMinor,
        providedTotalMinor: extracted.statementTotalMinor,
        valid: totalsValid
      }
    };

    const saved = await this.dependencies.previewRepository.create(preview);

    await this.dependencies.auditTrailRepository.record({
      accountId: parsed.accountId,
      actorId: parsed.authenticatedUserId,
      action: "STATEMENT_IMPORT_PREVIEW_CREATED",
      timestamp: nowIso,
      metadata: {
        previewId: previewId,
        acceptedRows: saved.rows.length,
        rejectedRows: saved.rejectedRows.length,
        duplicateCandidates: saved.duplicateCandidates.length
      }
    });

    return saved;
  }

  private validateFile(file: StatementUploadFile): void {
    if (!this.allowedMimeTypes.includes(file.mimeType)) {
      throw new UnsupportedMediaTypeApplicationError("Only CSV uploads are supported");
    }

    if (file.sizeBytes > this.dependencies.maxFileSizeBytes) {
      throw new PayloadTooLargeApplicationError("Statement file exceeds configured maximum size");
    }
  }
}
