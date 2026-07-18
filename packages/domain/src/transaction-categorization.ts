import { z } from "zod";

export const categoryTaxonomy = [
  "GROCERIES",
  "DINING",
  "TRANSPORTATION",
  "FUEL",
  "HOUSING",
  "UTILITIES",
  "INSURANCE",
  "HEALTHCARE",
  "SHOPPING",
  "ENTERTAINMENT",
  "TRAVEL",
  "EDUCATION",
  "CHILDCARE",
  "SUBSCRIPTIONS",
  "FEES",
  "INCOME",
  "TRANSFER",
  "INVESTMENT",
  "TAX",
  "UNCATEGORIZED"
] as const;

export const categorySchema = z.enum(categoryTaxonomy);

export type Category = z.infer<typeof categorySchema>;

export const categorizationSourceSchema = z.enum([
  "SYSTEM_RULE",
  "USER_RULE",
  "MERCHANT_RULE",
  "AI_SUGGESTION",
  "USER_CONFIRMED",
  "USER_CORRECTED"
]);

export type CategorizationSource = z.infer<typeof categorizationSourceSchema>;

export type RuleType =
  | "EXACT_MERCHANT"
  | "MERCHANT_KEYWORD"
  | "DESCRIPTION_PATTERN"
  | "AMOUNT_RANGE_WITH_MERCHANT"
  | "DEBIT_CREDIT";

export type CategorizationRule = {
  readonly id: string;
  readonly ownerUserId?: string;
  readonly priority: number;
  readonly category: Category;
  readonly ruleType: RuleType;
  readonly merchantNormalized?: string;
  readonly keywordNormalized?: string;
  readonly descriptionPattern?: string;
  readonly amountMinMinor?: bigint;
  readonly amountMaxMinor?: bigint;
  readonly direction?: "DEBIT" | "CREDIT";
  readonly source: "USER" | "SYSTEM" | "MERCHANT";
};

export type CategorizableTransaction = {
  readonly transactionId: string;
  readonly accountId: string;
  readonly ownerUserId: string;
  readonly description: string;
  readonly amountMinor: bigint;
  readonly direction: "DEBIT" | "CREDIT";
  readonly confirmedCategory?: Category;
  readonly importId?: string;
};

export type CategorizationResult = {
  readonly transactionId: string;
  readonly category: Category;
  readonly source: CategorizationSource;
  readonly confidence: number;
  readonly ruleId?: string;
  readonly explanation: string;
};

export const normalizeMerchantDescription = (input: string): string =>
  input.trim().toLowerCase().replace(/\s+/g, " ");

const getRuleTypeRank = (type: RuleType): number => {
  if (type === "EXACT_MERCHANT") {
    return 0;
  }

  if (type === "AMOUNT_RANGE_WITH_MERCHANT") {
    return 1;
  }

  if (type === "MERCHANT_KEYWORD") {
    return 2;
  }

  if (type === "DESCRIPTION_PATTERN") {
    return 3;
  }

  return 4;
};

const getRuleSourceRank = (source: "USER" | "SYSTEM" | "MERCHANT"): number => {
  if (source === "USER") {
    return 0;
  }

  if (source === "MERCHANT") {
    return 1;
  }

  return 2;
};

const compareRules = (left: CategorizationRule, right: CategorizationRule): number => {
  const sourceRankDelta = getRuleSourceRank(left.source) - getRuleSourceRank(right.source);
  if (sourceRankDelta !== 0) {
    return sourceRankDelta;
  }

  const typeRankDelta = getRuleTypeRank(left.ruleType) - getRuleTypeRank(right.ruleType);
  if (typeRankDelta !== 0) {
    return typeRankDelta;
  }

  const priorityDelta = left.priority - right.priority;
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.id.localeCompare(right.id);
};

const ruleMatches = (rule: CategorizationRule, transaction: CategorizableTransaction): boolean => {
  const normalized = normalizeMerchantDescription(transaction.description);

  if (rule.ruleType === "EXACT_MERCHANT") {
    return normalized === (rule.merchantNormalized ?? "");
  }

  if (rule.ruleType === "MERCHANT_KEYWORD") {
    return normalized.includes(rule.keywordNormalized ?? "");
  }

  if (rule.ruleType === "DESCRIPTION_PATTERN") {
    if (!rule.descriptionPattern) {
      return false;
    }

    return new RegExp(rule.descriptionPattern, "i").test(normalized);
  }

  if (rule.ruleType === "AMOUNT_RANGE_WITH_MERCHANT") {
    const merchantMatch = normalized.includes(rule.keywordNormalized ?? "");
    const minOk =
      rule.amountMinMinor === undefined || transaction.amountMinor >= rule.amountMinMinor;
    const maxOk =
      rule.amountMaxMinor === undefined || transaction.amountMinor <= rule.amountMaxMinor;

    return merchantMatch && minOk && maxOk;
  }

  if (rule.ruleType === "DEBIT_CREDIT") {
    return transaction.direction === rule.direction;
  }

  return false;
};

const toSource = (source: "USER" | "SYSTEM" | "MERCHANT"): CategorizationSource => {
  if (source === "USER") {
    return "USER_RULE";
  }

  if (source === "MERCHANT") {
    return "MERCHANT_RULE";
  }

  return "SYSTEM_RULE";
};

export const evaluateCategorizationRules = (input: {
  transaction: CategorizableTransaction;
  rules: ReadonlyArray<CategorizationRule>;
}): CategorizationResult => {
  if (input.transaction.confirmedCategory) {
    return {
      transactionId: input.transaction.transactionId,
      category: input.transaction.confirmedCategory,
      source: "USER_CONFIRMED",
      confidence: 1,
      explanation: "Transaction already has confirmed category and cannot be overwritten"
    };
  }

  const sortedRules = [...input.rules].sort(compareRules);
  const matchingRule = sortedRules.find((rule) => ruleMatches(rule, input.transaction));

  if (!matchingRule) {
    return {
      transactionId: input.transaction.transactionId,
      category: "UNCATEGORIZED",
      source: "SYSTEM_RULE",
      confidence: 0,
      explanation: "No deterministic categorization rule matched"
    };
  }

  return {
    transactionId: input.transaction.transactionId,
    category: matchingRule.category,
    source: toSource(matchingRule.source),
    confidence: 0.95,
    ruleId: matchingRule.id,
    explanation: `Matched ${matchingRule.ruleType} with priority ${matchingRule.priority}`
  };
};
