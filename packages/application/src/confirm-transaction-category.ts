import { ZodError, z } from "zod";

import { categorySchema } from "../../domain/src/transaction-categorization.js";
import { NotFoundApplicationError, ValidationApplicationError } from "./application-error.js";
import {
  type AuditTrailRepository,
  type CategorizationIdempotencyRepository,
  type TransactionRepository
} from "./ports.js";

export const confirmTransactionCategoryInputSchema = z.object({
  transactionId: z.string().min(1),
  authenticatedUserId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  category: categorySchema
});

export type ConfirmTransactionCategoryInput = z.infer<typeof confirmTransactionCategoryInputSchema>;

type Dependencies = {
  transactionRepository: TransactionRepository;
  idempotencyRepository: CategorizationIdempotencyRepository;
  auditTrailRepository: AuditTrailRepository;
  now?: () => Date;
};

export class ConfirmTransactionCategoryUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: ConfirmTransactionCategoryInput): Promise<{
    transactionId: string;
    category: z.infer<typeof categorySchema>;
    source: "USER_CONFIRMED";
  }> {
    let parsed: ConfirmTransactionCategoryInput;

    try {
      parsed = confirmTransactionCategoryInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid category confirmation request");
      }
      throw error;
    }

    const operation = "TRANSACTION_CONFIRM_CATEGORY";
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
        source: "USER_CONFIRMED";
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
        category: parsed.category,
        source: "USER_CONFIRMED",
        confidence: 1,
        explanation: "User explicitly confirmed category",
        confirmed: true
      }
    });

    await this.dependencies.auditTrailRepository.record({
      accountId: transaction.accountId,
      actorId: parsed.authenticatedUserId,
      action: "TRANSACTION_CATEGORY_CONFIRMED",
      timestamp: (this.dependencies.now ?? (() => new Date()))().toISOString(),
      metadata: {
        transactionId: transaction.transactionId,
        category: parsed.category
      }
    });

    const response = {
      transactionId: parsed.transactionId,
      category: parsed.category,
      source: "USER_CONFIRMED" as const
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
