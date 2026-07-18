import { ZodError, z } from "zod";

import {
  ConflictApplicationError,
  InvalidStateApplicationError,
  NotFoundApplicationError,
  ValidationApplicationError
} from "./application-error.js";
import {
  type AuditTrailRepository,
  type ImportedTransactionRepository,
  type StatementImportPreviewRepository
} from "./ports.js";

export const approveStatementImportInputSchema = z.object({
  previewId: z.string().min(1),
  accountId: z.string().min(1),
  authenticatedUserId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  approvedFingerprints: z.array(z.string().min(1)).optional()
});

export type ApproveStatementImportInput = z.infer<typeof approveStatementImportInputSchema>;

type Dependencies = {
  previewRepository: StatementImportPreviewRepository;
  importedTransactionRepository: ImportedTransactionRepository;
  auditTrailRepository: AuditTrailRepository;
  now?: () => Date;
};

export class ApproveStatementImportUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: ApproveStatementImportInput): Promise<{
    previewId: string;
    status: "IMPORTED";
    importedCount: number;
    importedAt: string;
  }> {
    let parsed: ApproveStatementImportInput;

    try {
      parsed = approveStatementImportInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid statement import approval request");
      }
      throw error;
    }

    const existing = await this.dependencies.previewRepository.findApprovalByIdempotencyKey({
      previewId: parsed.previewId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey
    });

    if (existing) {
      return {
        previewId: parsed.previewId,
        status: "IMPORTED",
        importedCount: existing.importedCount,
        importedAt: existing.importedAt
      };
    }

    const preview = await this.dependencies.previewRepository.findByIdForUser({
      previewId: parsed.previewId,
      ownerUserId: parsed.authenticatedUserId
    });

    if (!preview || preview.accountId !== parsed.accountId) {
      throw new NotFoundApplicationError("Statement import preview not found");
    }

    if (preview.status !== "PENDING_APPROVAL") {
      throw new InvalidStateApplicationError("Only pending previews can be approved");
    }

    const duplicateFingerprints = new Set(
      preview.duplicateCandidates.map((item) => item.fingerprint)
    );
    const rejectedRowNumbers = new Set(preview.rejectedRows.map((item) => item.rowNumber));

    const eligibleRows = preview.rows.filter(
      (row) => !duplicateFingerprints.has(row.fingerprint) && !rejectedRowNumbers.has(row.rowNumber)
    );

    let approvedRows = eligibleRows;

    if (parsed.approvedFingerprints && parsed.approvedFingerprints.length > 0) {
      const approvedSet = new Set(parsed.approvedFingerprints);
      approvedRows = eligibleRows.filter((row) => approvedSet.has(row.fingerprint));

      if (approvedRows.length !== approvedSet.size) {
        throw new ConflictApplicationError("Approved fingerprint list contains unknown rows");
      }
    }

    const nowIso = (this.dependencies.now ?? (() => new Date()))().toISOString();

    await this.dependencies.previewRepository.updateStatus({
      previewId: preview.previewId,
      status: "APPROVED",
      approvedBy: parsed.authenticatedUserId,
      approvedAt: nowIso
    });

    const importResult = await this.dependencies.importedTransactionRepository.importApprovedRows({
      previewId: preview.previewId,
      accountId: preview.accountId,
      actorId: parsed.authenticatedUserId,
      rows: approvedRows,
      importedAt: nowIso
    });

    await this.dependencies.previewRepository.updateStatus({
      previewId: preview.previewId,
      status: "IMPORTED",
      importedAt: nowIso
    });

    await this.dependencies.previewRepository.saveApprovalIdempotencyKey({
      previewId: preview.previewId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey,
      importedCount: importResult.importedCount,
      importedAt: nowIso
    });

    await this.dependencies.auditTrailRepository.record({
      accountId: preview.accountId,
      actorId: parsed.authenticatedUserId,
      action: "STATEMENT_IMPORT_APPROVED",
      timestamp: nowIso,
      metadata: {
        previewId: preview.previewId,
        importedCount: importResult.importedCount
      }
    });

    return {
      previewId: preview.previewId,
      status: "IMPORTED",
      importedCount: importResult.importedCount,
      importedAt: nowIso
    };
  }
}
