import { describe, expect, it } from "vitest";

import {
  ApproveStatementImportUseCase,
  CreateStatementImportPreviewUseCase
} from "../packages/application/src/index.js";
import { InMemoryAuditTrailRepository } from "../packages/infrastructure/src/in-memory-audit-trail-repository.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";
import { InMemoryImportedTransactionRepository } from "../packages/infrastructure/src/in-memory-imported-transaction-repository.js";
import { InMemoryPostedTransactionFingerprintReadRepository } from "../packages/infrastructure/src/in-memory-posted-transaction-fingerprint-repository.js";
import { InMemoryStatementImportPreviewRepository } from "../packages/infrastructure/src/in-memory-statement-import-preview-repository.js";

describe("ApproveStatementImportUseCase", () => {
  it("imports approved rows and enforces idempotency key", async () => {
    const previewRepository = new InMemoryStatementImportPreviewRepository();
    const importedRepository = new InMemoryImportedTransactionRepository();
    const auditRepository = new InMemoryAuditTrailRepository();

    const createPreview = new CreateStatementImportPreviewUseCase({
      accountReadRepository: new InMemoryCreditCardAccountReadRepository([
        {
          accountId: "card-1",
          ownerUserId: "user-1",
          creditLimit: { amountMinor: 100000n, currency: "USD" },
          currentBalance: { amountMinor: 20000n, currency: "USD" }
        }
      ]),
      statementExtractor: {
        extract: async () => ({
          rows: [
            {
              rowNumber: 2,
              occurredOn: "2026-07-10",
              description: "Coffee Shop",
              amountMinor: "455",
              currency: "USD"
            }
          ],
          statementTotalMinor: "455"
        })
      },
      previewRepository,
      postedFingerprintRepository: new InMemoryPostedTransactionFingerprintReadRepository({}),
      auditTrailRepository: auditRepository,
      maxFileSizeBytes: 2000000,
      createId: () => "preview-1",
      now: () => new Date("2026-07-18T00:00:00.000Z")
    });

    await createPreview.execute({
      accountId: "card-1",
      authenticatedUserId: "user-1",
      file: {
        fileName: "statement.csv",
        mimeType: "text/csv",
        sizeBytes: 100,
        content: Buffer.from("date,description,amountMinor,currency\n")
      }
    });

    const approve = new ApproveStatementImportUseCase({
      previewRepository,
      importedTransactionRepository: importedRepository,
      auditTrailRepository: auditRepository,
      now: () => new Date("2026-07-18T00:00:10.000Z")
    });

    const first = await approve.execute({
      previewId: "preview-1",
      accountId: "card-1",
      authenticatedUserId: "user-1",
      idempotencyKey: "idem-key-1234"
    });

    const second = await approve.execute({
      previewId: "preview-1",
      accountId: "card-1",
      authenticatedUserId: "user-1",
      idempotencyKey: "idem-key-1234"
    });

    expect(first.importedCount).toBe(1);
    expect(second.importedCount).toBe(1);
    expect(importedRepository.imported.length).toBe(1);
  });
});
