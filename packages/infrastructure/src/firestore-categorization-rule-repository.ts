import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { type CategorizationRuleRepository } from "../../application/src/ports.js";
import {
  type CategorizationRule,
  categorySchema,
  normalizeMerchantDescription
} from "../../domain/src/transaction-categorization.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

const toRule = (id: string, data: Record<string, unknown>): CategorizationRule | null => {
  const ruleType = data.ruleType;
  const priority = data.priority;
  const source = data.source;

  if (
    typeof ruleType !== "string" ||
    typeof priority !== "number" ||
    (source !== "USER" && source !== "SYSTEM" && source !== "MERCHANT")
  ) {
    return null;
  }

  try {
    return {
      id,
      ownerUserId: typeof data.ownerUserId === "string" ? data.ownerUserId : undefined,
      priority,
      category: categorySchema.parse(data.category),
      ruleType: ruleType as CategorizationRule["ruleType"],
      merchantNormalized:
        typeof data.merchantNormalized === "string"
          ? normalizeMerchantDescription(data.merchantNormalized)
          : undefined,
      keywordNormalized:
        typeof data.keywordNormalized === "string"
          ? normalizeMerchantDescription(data.keywordNormalized)
          : undefined,
      descriptionPattern:
        typeof data.descriptionPattern === "string" ? data.descriptionPattern : undefined,
      amountMinMinor:
        typeof data.amountMinMinor === "string" ? BigInt(data.amountMinMinor) : undefined,
      amountMaxMinor:
        typeof data.amountMaxMinor === "string" ? BigInt(data.amountMaxMinor) : undefined,
      direction:
        data.direction === "DEBIT" || data.direction === "CREDIT" ? data.direction : undefined,
      source
    };
  } catch {
    return null;
  }
};

export class FirestoreCategorizationRuleRepository implements CategorizationRuleRepository {
  async listByOwnerUserId(ownerUserId: string): Promise<ReadonlyArray<CategorizationRule>> {
    ensureFirebaseApp();
    const db = getFirestore();

    const [userRules, sharedRules] = await Promise.all([
      db.collection("categorizationRules").where("ownerUserId", "==", ownerUserId).get(),
      db.collection("categorizationRules").where("ownerUserId", "==", null).get()
    ]);

    const rules: CategorizationRule[] = [];
    for (const doc of [...userRules.docs, ...sharedRules.docs]) {
      const rule = toRule(doc.id, doc.data());
      if (rule) {
        rules.push(rule);
      }
    }

    return rules;
  }

  async upsert(rule: CategorizationRule): Promise<void> {
    ensureFirebaseApp();
    const db = getFirestore();

    await db
      .collection("categorizationRules")
      .doc(rule.id)
      .set(
        {
          ownerUserId: rule.ownerUserId ?? null,
          priority: rule.priority,
          category: rule.category,
          ruleType: rule.ruleType,
          merchantNormalized: rule.merchantNormalized ?? null,
          keywordNormalized: rule.keywordNormalized ?? null,
          descriptionPattern: rule.descriptionPattern ?? null,
          amountMinMinor: rule.amountMinMinor?.toString() ?? null,
          amountMaxMinor: rule.amountMaxMinor?.toString() ?? null,
          direction: rule.direction ?? null,
          source: rule.source
        },
        { merge: true }
      );
  }
}
