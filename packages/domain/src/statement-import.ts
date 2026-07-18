import { type CurrencyCode, makeMoney, type Money } from "./money.js";

export type StatementImportStatus =
  "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "IMPORTED" | "FAILED";

export type NormalizedStatementTransaction = {
  readonly rowNumber: number;
  readonly occurredOn: string;
  readonly description: string;
  readonly amount: Money;
  readonly fingerprint: string;
};

export type StatementRejectedRow = {
  readonly rowNumber: number;
  readonly reason: string;
};

export type StatementDuplicateCandidate = {
  readonly fingerprint: string;
  readonly rowNumbers: ReadonlyArray<number>;
  readonly reason: "within_statement" | "already_posted";
};

export type StatementImportWarning = {
  readonly code: "totals_missing" | "totals_mismatch";
  readonly message: string;
};

export type StatementImportPreview = {
  readonly previewId: string;
  readonly accountId: string;
  readonly ownerUserId: string;
  readonly status: StatementImportStatus;
  readonly sourceFileName: string;
  readonly createdAt: string;
  readonly rows: ReadonlyArray<NormalizedStatementTransaction>;
  readonly rejectedRows: ReadonlyArray<StatementRejectedRow>;
  readonly duplicateCandidates: ReadonlyArray<StatementDuplicateCandidate>;
  readonly warnings: ReadonlyArray<StatementImportWarning>;
  readonly totals: {
    readonly calculatedTotalMinor: string;
    readonly providedTotalMinor?: string;
    readonly valid: boolean;
  };
  readonly approvedAt?: string;
  readonly approvedBy?: string;
  readonly importedAt?: string;
};

const normalizeDescription = (input: string): string =>
  input.trim().replace(/\s+/g, " ").toLowerCase();

const fnv1a64 = (input: string): string => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const character of input) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, "0");
};

export const createTransactionFingerprint = (input: {
  accountId: string;
  occurredOn: string;
  description: string;
  amountMinor: bigint;
  currency: CurrencyCode;
}): string => {
  const canonical = [
    input.accountId,
    input.occurredOn,
    normalizeDescription(input.description),
    input.amountMinor.toString(),
    input.currency
  ].join("|");

  return fnv1a64(canonical);
};

export const createNormalizedTransaction = (input: {
  accountId: string;
  rowNumber: number;
  occurredOn: string;
  description: string;
  amountMinor: bigint;
  currency: CurrencyCode;
}): NormalizedStatementTransaction => ({
  rowNumber: input.rowNumber,
  occurredOn: input.occurredOn,
  description: input.description.trim(),
  amount: makeMoney(input.amountMinor, input.currency),
  fingerprint: createTransactionFingerprint({
    accountId: input.accountId,
    occurredOn: input.occurredOn,
    description: input.description,
    amountMinor: input.amountMinor,
    currency: input.currency
  })
});

export const detectDuplicateFingerprints = (
  transactions: ReadonlyArray<NormalizedStatementTransaction>
): ReadonlyArray<StatementDuplicateCandidate> => {
  const seen = new Map<string, number[]>();

  for (const transaction of transactions) {
    const rows = seen.get(transaction.fingerprint) ?? [];
    rows.push(transaction.rowNumber);
    seen.set(transaction.fingerprint, rows);
  }

  return [...seen.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([fingerprint, rows]) => ({
      fingerprint,
      rowNumbers: rows,
      reason: "within_statement"
    }));
};

export const calculateStatementTotalMinor = (
  transactions: ReadonlyArray<NormalizedStatementTransaction>
): bigint => transactions.reduce((acc, item) => acc + item.amount.amountMinor, 0n);
