import { type ImportedTransactionRepository } from "../../application/src/ports.js";
import { type NormalizedStatementTransaction } from "../../domain/src/statement-import.js";
import { type InMemoryPostedTransactionFingerprintReadRepository } from "./in-memory-posted-transaction-fingerprint-repository.js";

export class InMemoryImportedTransactionRepository implements ImportedTransactionRepository {
  constructor(
    private readonly postedFingerprintRepository?: InMemoryPostedTransactionFingerprintReadRepository
  ) {}

  imported: Array<{
    previewId: string;
    accountId: string;
    actorId: string;
    importedAt: string;
    count: number;
  }> = [];

  async importApprovedRows(input: {
    previewId: string;
    accountId: string;
    actorId: string;
    rows: ReadonlyArray<NormalizedStatementTransaction>;
    importedAt: string;
  }): Promise<{ importedCount: number }> {
    this.imported.push({
      previewId: input.previewId,
      accountId: input.accountId,
      actorId: input.actorId,
      importedAt: input.importedAt,
      count: input.rows.length
    });

    this.postedFingerprintRepository?.addFingerprints(
      input.accountId,
      input.rows.map((row) => row.fingerprint)
    );

    return { importedCount: input.rows.length };
  }
}
