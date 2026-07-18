import { describe, expect, it } from "vitest";

import { CreateJournalEntryUseCase } from "../packages/application/src/create-journal-entry.js";
import { makeMoney } from "../packages/domain/src/money.js";

describe("CreateJournalEntryUseCase", () => {
  it("blocks writes when approval is not granted", async () => {
    const useCase = new CreateJournalEntryUseCase(
      {
        requestHumanApproval: async () => ({ approved: false })
      },
      {
        saveEntry: async () => ({ id: "entry-1" })
      }
    );

    await expect(
      useCase.execute({
        accountId: "acct-1",
        description: "create entry",
        requestedBy: "user-1",
        amount: makeMoney(100n, "USD")
      })
    ).rejects.toThrowError("Human approval required before write operations");
  });

  it("persists after approval", async () => {
    const useCase = new CreateJournalEntryUseCase(
      {
        requestHumanApproval: async () => ({ approved: true, approverId: "approver-1" })
      },
      {
        saveEntry: async () => ({ id: "entry-1" })
      }
    );

    await expect(
      useCase.execute({
        accountId: "acct-1",
        description: "create entry",
        requestedBy: "user-1",
        amount: makeMoney(100n, "USD")
      })
    ).resolves.toEqual({ id: "entry-1", approvedBy: "approver-1" });
  });
});
