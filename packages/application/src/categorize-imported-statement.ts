import { ZodError, z } from "zod";

import { ValidationApplicationError } from "./application-error.js";
import { type CategorizeTransactionUseCase } from "./categorize-transaction.js";
import { type CategorizationIdempotencyRepository, type TransactionRepository } from "./ports.js";

export const categorizeImportedStatementInputSchema = z.object({
  importId: z.string().min(1),
  authenticatedUserId: z.string().min(1),
  idempotencyKey: z.string().min(8)
});

export type CategorizeImportedStatementInput = z.infer<
  typeof categorizeImportedStatementInputSchema
>;

type Dependencies = {
  transactionRepository: TransactionRepository;
  idempotencyRepository: CategorizationIdempotencyRepository;
  categorizeTransactionUseCase: Pick<CategorizeTransactionUseCase, "execute">;
  now?: () => Date;
};

export class CategorizeImportedStatementUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: CategorizeImportedStatementInput): Promise<{
    importId: string;
    categorizedCount: number;
    uncategorizedCount: number;
  }> {
    let parsed: CategorizeImportedStatementInput;

    try {
      parsed = categorizeImportedStatementInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid import categorization request");
      }
      throw error;
    }

    const operation = "IMPORT_CATEGORIZE";
    const existing = await this.dependencies.idempotencyRepository.findResult({
      operation,
      targetId: parsed.importId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey
    });

    if (existing) {
      return existing as {
        importId: string;
        categorizedCount: number;
        uncategorizedCount: number;
      };
    }

    const transactions = await this.dependencies.transactionRepository.listByImportIdForUser({
      importId: parsed.importId,
      ownerUserId: parsed.authenticatedUserId
    });

    let categorizedCount = 0;
    let uncategorizedCount = 0;

    for (const transaction of transactions) {
      const result = await this.dependencies.categorizeTransactionUseCase.execute({
        transactionId: transaction.transactionId,
        authenticatedUserId: parsed.authenticatedUserId,
        idempotencyKey: `${parsed.idempotencyKey}:${transaction.transactionId}`
      });

      if (result.category === "UNCATEGORIZED") {
        uncategorizedCount += 1;
      } else {
        categorizedCount += 1;
      }
    }

    const response = {
      importId: parsed.importId,
      categorizedCount,
      uncategorizedCount
    };

    await this.dependencies.idempotencyRepository.saveResult({
      operation,
      targetId: parsed.importId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey,
      createdAt: (this.dependencies.now ?? (() => new Date()))().toISOString(),
      response
    });

    return response;
  }
}
