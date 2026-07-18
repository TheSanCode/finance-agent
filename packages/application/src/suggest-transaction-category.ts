import { ZodError, z } from "zod";

import {
  categoryTaxonomy,
  evaluateCategorizationRules
} from "../../domain/src/transaction-categorization.js";
import { NotFoundApplicationError, ValidationApplicationError } from "./application-error.js";
import {
  type AuditTrailRepository,
  type CategorizationIdempotencyRepository,
  type CategorizationRuleRepository,
  type CategorySuggestionProvider,
  type TransactionRepository
} from "./ports.js";

export const suggestTransactionCategoryInputSchema = z.object({
  transactionId: z.string().min(1),
  authenticatedUserId: z.string().min(1),
  idempotencyKey: z.string().min(8)
});

export type SuggestTransactionCategoryInput = z.infer<typeof suggestTransactionCategoryInputSchema>;

type Dependencies = {
  transactionRepository: TransactionRepository;
  categorizationRuleRepository: CategorizationRuleRepository;
  categorySuggestionProvider: CategorySuggestionProvider;
  idempotencyRepository: CategorizationIdempotencyRepository;
  auditTrailRepository: AuditTrailRepository;
  now?: () => Date;
};

export class SuggestTransactionCategoryUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: SuggestTransactionCategoryInput): Promise<{
    transactionId: string;
    deterministicResult: {
      category: (typeof categoryTaxonomy)[number];
      source: string;
      confidence: number;
      ruleId?: string;
      explanation: string;
    } | null;
    suggestion: {
      category: (typeof categoryTaxonomy)[number];
      confidence: number;
      rationale: string;
    } | null;
  }> {
    let parsed: SuggestTransactionCategoryInput;

    try {
      parsed = suggestTransactionCategoryInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid category suggestion request");
      }
      throw error;
    }

    const operation = "TRANSACTION_SUGGEST_CATEGORY";
    const existing = await this.dependencies.idempotencyRepository.findResult({
      operation,
      targetId: parsed.transactionId,
      actorId: parsed.authenticatedUserId,
      idempotencyKey: parsed.idempotencyKey
    });

    if (existing) {
      return existing as {
        transactionId: string;
        deterministicResult: {
          category: (typeof categoryTaxonomy)[number];
          source: string;
          confidence: number;
          ruleId?: string;
          explanation: string;
        } | null;
        suggestion: {
          category: (typeof categoryTaxonomy)[number];
          confidence: number;
          rationale: string;
        } | null;
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

    const deterministicResult = evaluateCategorizationRules({
      transaction,
      rules
    });

    // Deterministic-first invariant: Gemini is only consulted on deterministic no-match.
    const hasDeterministicMatch = deterministicResult.category !== "UNCATEGORIZED";

    const suggestion = hasDeterministicMatch
      ? null
      : await this.dependencies.categorySuggestionProvider.suggest({
          transaction,
          allowedCategories: [...categoryTaxonomy]
        });

    const response = {
      transactionId: parsed.transactionId,
      deterministicResult: hasDeterministicMatch
        ? {
            category: deterministicResult.category,
            source: deterministicResult.source,
            confidence: deterministicResult.confidence,
            ruleId: deterministicResult.ruleId,
            explanation: deterministicResult.explanation
          }
        : null,
      suggestion
    };

    await this.dependencies.auditTrailRepository.record({
      accountId: transaction.accountId,
      actorId: parsed.authenticatedUserId,
      action: "TRANSACTION_CATEGORY_SUGGESTED",
      timestamp: (this.dependencies.now ?? (() => new Date()))().toISOString(),
      metadata: {
        transactionId: transaction.transactionId,
        deterministicMatched: hasDeterministicMatch ? "yes" : "no",
        suggested: suggestion ? "yes" : "no"
      }
    });

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
