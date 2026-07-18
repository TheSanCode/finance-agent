import { type Money } from "../../domain/src/money.js";
import { type CreditCardAccount } from "../../domain/src/credit-card-summary.js";

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
