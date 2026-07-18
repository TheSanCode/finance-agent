import { describe, expect, it } from "vitest";

import { CreateStatementImportPreviewUseCase } from "../packages/application/src/index.js";
import { InMemoryAuditTrailRepository } from "../packages/infrastructure/src/in-memory-audit-trail-repository.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";
import { InMemoryPostedTransactionFingerprintReadRepository } from "../packages/infrastructure/src/in-memory-posted-transaction-fingerprint-repository.js";
import { InMemoryStatementImportPreviewRepository } from "../packages/infrastructure/src/in-memory-statement-import-preview-repository.js";

describe("CreateStatementImportPreviewUseCase", () => {
  it("creates pending approval preview with duplicates, warnings, and rejected rows", async () => {
    const previewRepository = new InMemoryStatementImportPreviewRepository();
    const auditRepository = new InMemoryAuditTrailRepository();

    const useCase = new CreateStatementImportPreviewUseCase({
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
            },
            {
              rowNumber: 3,
              occurredOn: "2026-07-10",
              description: "coffee shop",
              amountMinor: "455",
              currency: "USD"
            },
            {
              rowNumber: 4,
              occurredOn: "invalid-date",
              description: "bad",
              amountMinor: "100",
              currency: "USD"
            }
          ]
        })
      },
      previewRepository,
      postedFingerprintRepository: new InMemoryPostedTransactionFingerprintReadRepository({}),
      auditTrailRepository: auditRepository,
      maxFileSizeBytes: 2000000,
      now: () => new Date("2026-07-18T00:00:00.000Z"),
      createId: () => "preview-1"
    });

    const preview = await useCase.execute({
      accountId: "card-1",
      authenticatedUserId: "user-1",
      file: {
        fileName: "statement.csv",
        mimeType: "text/csv",
        sizeBytes: 128,
        content: Buffer.from("date,description,amountMinor,currency\n")
      }
    });

    expect(preview.previewId).toBe("preview-1");
    expect(preview.status).toBe("PENDING_APPROVAL");
    expect(preview.duplicateCandidates.length).toBe(1);
    expect(preview.rejectedRows.length).toBe(1);
    expect(preview.warnings.some((warning) => warning.code === "totals_missing")).toBe(true);
    expect(auditRepository.records.length).toBe(1);
  });
});
