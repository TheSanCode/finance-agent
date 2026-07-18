import {
  type StatementImportPreview,
  type StatementImportStatus
} from "../../domain/src/statement-import.js";
import { type StatementImportPreviewRepository } from "../../application/src/ports.js";

type ApprovalRecord = {
  importedCount: number;
  importedAt: string;
};

export class InMemoryStatementImportPreviewRepository implements StatementImportPreviewRepository {
  private readonly previews = new Map<string, StatementImportPreview>();
  private readonly approvals = new Map<string, ApprovalRecord>();

  constructor(seed: ReadonlyArray<StatementImportPreview> = []) {
    for (const preview of seed) {
      this.previews.set(preview.previewId, preview);
    }
  }

  async create(preview: StatementImportPreview): Promise<StatementImportPreview> {
    this.previews.set(preview.previewId, preview);
    return preview;
  }

  async findByIdForUser(input: {
    previewId: string;
    ownerUserId: string;
  }): Promise<StatementImportPreview | null> {
    const preview = this.previews.get(input.previewId);
    if (!preview || preview.ownerUserId !== input.ownerUserId) {
      return null;
    }

    return preview;
  }

  async updateStatus(input: {
    previewId: string;
    status: StatementImportStatus;
    approvedBy?: string;
    approvedAt?: string;
    importedAt?: string;
  }): Promise<StatementImportPreview> {
    const existing = this.previews.get(input.previewId);
    if (!existing) {
      throw new Error("preview_not_found");
    }

    const updated: StatementImportPreview = {
      ...existing,
      status: input.status,
      approvedBy: input.approvedBy ?? existing.approvedBy,
      approvedAt: input.approvedAt ?? existing.approvedAt,
      importedAt: input.importedAt ?? existing.importedAt
    };

    this.previews.set(input.previewId, updated);
    return updated;
  }

  async findApprovalByIdempotencyKey(input: {
    previewId: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<{ importedCount: number; importedAt: string } | null> {
    return (
      this.approvals.get(`${input.previewId}|${input.actorId}|${input.idempotencyKey}`) ?? null
    );
  }

  async saveApprovalIdempotencyKey(input: {
    previewId: string;
    actorId: string;
    idempotencyKey: string;
    importedCount: number;
    importedAt: string;
  }): Promise<void> {
    this.approvals.set(`${input.previewId}|${input.actorId}|${input.idempotencyKey}`, {
      importedCount: input.importedCount,
      importedAt: input.importedAt
    });
  }
}
