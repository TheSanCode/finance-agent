import { z } from "zod";

import { type Money } from "../../domain/src/money.js";
import { type ApprovalPort, type LedgerRepository } from "./ports.js";

export const createJournalEntryInputSchema = z.object({
  accountId: z.string().min(1),
  description: z.string().min(3),
  requestedBy: z.string().min(1)
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntryInputSchema> & {
  readonly amount: Money;
};

export class CreateJournalEntryUseCase {
  constructor(
    private readonly approvals: ApprovalPort,
    private readonly ledgerRepository: LedgerRepository
  ) {}

  async execute(input: CreateJournalEntryInput): Promise<{ id: string; approvedBy: string }> {
    createJournalEntryInputSchema.parse(input);

    const approval = await this.approvals.requestHumanApproval({
      operation: "create-journal-entry",
      reason: input.description,
      requestedBy: input.requestedBy
    });

    if (!approval.approved || !approval.approverId) {
      throw new Error("Human approval required before write operations");
    }

    const saved = await this.ledgerRepository.saveEntry({
      accountId: input.accountId,
      amount: input.amount,
      description: input.description
    });

    return { id: saved.id, approvedBy: approval.approverId };
  }
}
