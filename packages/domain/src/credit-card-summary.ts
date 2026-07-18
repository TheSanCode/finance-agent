import { z } from "zod";

import { subtractMoney, type CurrencyCode, type Money } from "./money.js";

export type CreditCardAccount = {
  readonly accountId: string;
  readonly ownerUserId: string;
  readonly creditLimit: Money;
  readonly currentBalance: Money;
};

export type CreditCardSummary = {
  readonly accountId: string;
  readonly currency: CurrencyCode;
  readonly creditLimit: Money;
  readonly currentBalance: Money;
  readonly availableCredit: Money;
  readonly utilizationBasisPoints: bigint;
};

export const utilizationBasisPointsSchema = z.bigint().min(0n);

const calculateUtilizationBasisPoints = (balanceMinor: bigint, limitMinor: bigint): bigint => {
  if (limitMinor <= 0n) {
    return 0n;
  }

  if (balanceMinor <= 0n) {
    return 0n;
  }

  return (balanceMinor * 10000n) / limitMinor;
};

export const calculateCreditCardSummary = (account: CreditCardAccount): CreditCardSummary => {
  const availableCredit = subtractMoney(account.creditLimit, account.currentBalance);

  const utilizationBasisPoints = calculateUtilizationBasisPoints(
    account.currentBalance.amountMinor,
    account.creditLimit.amountMinor
  );

  utilizationBasisPointsSchema.parse(utilizationBasisPoints);

  return {
    accountId: account.accountId,
    currency: account.creditLimit.currency,
    creditLimit: account.creditLimit,
    currentBalance: account.currentBalance,
    availableCredit,
    utilizationBasisPoints
  };
};
