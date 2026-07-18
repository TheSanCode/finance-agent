import {
  type CategorizationRule,
  normalizeMerchantDescription
} from "../../domain/src/transaction-categorization.js";
import { type CategorizationRuleRepository } from "../../application/src/ports.js";

export class InMemoryCategorizationRuleRepository implements CategorizationRuleRepository {
  private readonly rules = new Map<string, CategorizationRule>();

  constructor(seed: ReadonlyArray<CategorizationRule> = []) {
    for (const rule of seed) {
      this.rules.set(rule.id, this.normalize(rule));
    }
  }

  async listByOwnerUserId(ownerUserId: string): Promise<ReadonlyArray<CategorizationRule>> {
    return [...this.rules.values()].filter((rule) => {
      return rule.ownerUserId === ownerUserId || rule.ownerUserId === undefined;
    });
  }

  async upsert(rule: CategorizationRule): Promise<void> {
    this.rules.set(rule.id, this.normalize(rule));
  }

  private normalize(rule: CategorizationRule): CategorizationRule {
    return {
      ...rule,
      merchantNormalized: rule.merchantNormalized
        ? normalizeMerchantDescription(rule.merchantNormalized)
        : undefined,
      keywordNormalized: rule.keywordNormalized
        ? normalizeMerchantDescription(rule.keywordNormalized)
        : undefined
    };
  }
}
