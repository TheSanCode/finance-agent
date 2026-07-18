import { ZodError, z } from "zod";

import { evaluateCategorizationRules } from "../../domain/src/transaction-categorization.js";
import { NotFoundApplicationError, ValidationApplicationError } from "./application-error.js";
import {
  type AuditTrailRepository,
  type CategorizationIdempotencyRepository,
  type CategorizationRuleRepository,
  type TransactionRepository
} from "./ports.js";

export const categorizeTransactionInputSchema = z.object({
  transactionId: z.string().min(1),
  authenticatedUserId: z.string().min(1),
  idempotencyKey: z.string().min(8)
});

export type CategorizeTransactionInput = z.infer<typeof categorizeTransactionInputSchema>;

type Dependencies = {
  transactionRepository: TransactionRepository;
  categorizationRuleRepository: CategorizationRuleRepository;
  auditTrailRepository: AuditTrailRepository;
  idempotencyRepository: CategorizationIdempotencyRepository;
  now?: () => Date;
};

export class CategorizeTransactionUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: CategorizeTransactionInput) {
    let parsed: CategorizeTransactionInput;

    try {
      parsed = categorizeTransactionInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid transaction categorization request");
      }
      throw error;
    }

    const operation = "TRANSACTION_CATEGORIZE";
    const existing = await this.dependencies.idempotencyRepository.findResult({
      operation,
      targetId: parsed.transactionId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey
    });

    if (existing) {
      return existing as {
        transactionId: string;
        category: string;
        source: string;
        confidence: number;
        ruleId?: string;
        explanation: string;
      };
    }

    const transaction = await this.dependencies.transactionRepository.findByIdForUser({
      transactionId: parsed.transactionId,
      ownerUserId: parsed.authenticatedUserId
    });

    if (!transaction) {
      throw new NotFoundApplicationError("Transaction not found");
    }

    const rules = await this.dependencies.categorizationRuleRepository.listByOwnerUserId(
      parsed.authenticatedUserId
    );

    const result = evaluateCategorizationRules({
      transaction,
      rules
    });

    await this.dependencies.transactionRepository.saveCategorization({
      transactionId: parsed.transactionId,
      ownerUserId: parsed.authenticatedUserId,
      update: {
        category: result.category,
        source: result.source,
        confidence: result.confidence,
        explanation: result.explanation,
        ruleId: result.ruleId,
        confirmed: result.source === "USER_CONFIRMED"
      }
    });

    await this.dependencies.auditTrailRepository.record({
      accountId: transaction.accountId,
      actorId: parsed.authenticatedUserId,
      action: "TRANSACTION_CATEGORIZED",
      timestamp: (this.dependencies.now ?? (() => new Date()))().toISOString(),
      metadata: {
        transactionId: transaction.transactionId,
        category: result.category,
        source: result.source,
        confidence: result.confidence
      }
    });

    await this.dependencies.idempotencyRepository.saveResult({
      operation,
      targetId: parsed.transactionId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey,
      createdAt: (this.dependencies.now ?? (() => new Date()))().toISOString(),
      response: {
        transactionId: result.transactionId,
        category: result.category,
        source: result.source,
        confidence: result.confidence,
        ruleId: result.ruleId,
        explanation: result.explanation
      }
    });

    return result;
  }
}
