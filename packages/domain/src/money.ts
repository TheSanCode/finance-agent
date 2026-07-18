import { z } from "zod";

export const currencyCodeSchema = z
  .string()
  .length(3)
  .transform((value) => value.toUpperCase());

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

export type Money = {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
};

export const makeMoney = (amountMinor: bigint, currency: CurrencyCode): Money => ({
  amountMinor,
  currency
});

export const addMoney = (left: Money, right: Money): Money => {
  if (left.currency !== right.currency) {
    throw new Error("Currency mismatch");
  }

  return makeMoney(left.amountMinor + right.amountMinor, left.currency);
};

export const subtractMoney = (left: Money, right: Money): Money => {
  if (left.currency !== right.currency) {
    throw new Error("Currency mismatch");
  }

  return makeMoney(left.amountMinor - right.amountMinor, left.currency);
};
