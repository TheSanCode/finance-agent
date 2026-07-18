import { randomUUID } from "node:crypto";

import { ZodError, z } from "zod";

import {
  type CategorizationRule,
  categorySchema,
  normalizeMerchantDescription
} from "../../domain/src/transaction-categorization.js";
import { NotFoundApplicationError, ValidationApplicationError } from "./application-error.js";
import {
  type AuditTrailRepository,
  type CategorizationIdempotencyRepository,
  type CategorizationRuleRepository,
  type TransactionRepository
} from "./ports.js";

export const correctTransactionCategoryInputSchema = z.object({
  transactionId: z.string().min(1),
  authenticatedUserId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  correctedCategory: categorySchema,
  learnMerchantRule: z.boolean().default(true)
});

export type CorrectTransactionCategoryInput = z.infer<typeof correctTransactionCategoryInputSchema>;

type Dependencies = {
  transactionRepository: TransactionRepository;
  categorizationRuleRepository: CategorizationRuleRepository;
  idempotencyRepository: CategorizationIdempotencyRepository;
  auditTrailRepository: AuditTrailRepository;
  createId?: () => string;
  now?: () => Date;
};

export class CorrectTransactionCategoryUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: CorrectTransactionCategoryInput): Promise<{
    transactionId: string;
    category: z.infer<typeof categorySchema>;
    source: "USER_CORRECTED";
    createdRuleId?: string;
  }> {
    let parsed: CorrectTransactionCategoryInput;

    try {
      parsed = correctTransactionCategoryInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid category correction request");
      }
      throw error;
    }

    const operation = "TRANSACTION_CORRECT_CATEGORY";
    const existing = await this.dependencies.idempotencyRepository.findResult({
      operation,
      targetId: parsed.transactionId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey
    });

    if (existing) {
      return existing as {
        transactionId: string;
        category: z.infer<typeof categorySchema>;
        source: "USER_CORRECTED";
        createdRuleId?: string;
      };
    }

    const transaction = await this.dependencies.transactionRepository.findByIdForUser({
      transactionId: parsed.transactionId,
      ownerUserId: parsed.authenticatedUserId
    });

    if (!transaction) {
      throw new NotFoundApplicationError("Transaction not found");
    }

    await this.dependencies.transactionRepository.saveCategorization({
      transactionId: parsed.transactionId,
      ownerUserId: parsed.authenticatedUserId,
      update: {
        category: parsed.correctedCategory,
        source: "USER_CORRECTED",
        confidence: 1,
        explanation: "User corrected category",
        confirmed: true
      }
    });

    let createdRuleId: string | undefined;

    if (parsed.learnMerchantRule) {
      createdRuleId = (this.dependencies.createId ?? randomUUID)();
      const rule: CategorizationRule = {
        id: createdRuleId,
        ownerUserId: parsed.authenticatedUserId,
        priority: 10,
        category: parsed.correctedCategory,
        ruleType: "EXACT_MERCHANT",
        merchantNormalized: normalizeMerchantDescription(transaction.description),
        source: "USER"
      };
      await this.dependencies.categorizationRuleRepository.upsert(rule);
    }

    await this.dependencies.auditTrailRepository.record({
      accountId: transaction.accountId,
      actorId: parsed.authenticatedUserId,
      action: "TRANSACTION_CATEGORY_CORRECTED",
      timestamp: (this.dependencies.now ?? (() => new Date()))().toISOString(),
      metadata: {
        transactionId: transaction.transactionId,
        category: parsed.correctedCategory,
        createdRule: createdRuleId ? "yes" : "no"
      }
    });

    const response = {
      transactionId: parsed.transactionId,
      category: parsed.correctedCategory,
      source: "USER_CORRECTED" as const,
      createdRuleId
    };

    await this.dependencies.idempotencyRepository.saveResult({
      operation,
      targetId: parsed.transactionId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey,
      createdAt: (this.dependencies.now ?? (() => new Date()))().toISOString(),
      response
    });

    return response;
  }
}
