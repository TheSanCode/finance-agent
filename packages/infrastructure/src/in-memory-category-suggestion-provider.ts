import {
  type Category,
  normalizeMerchantDescription
} from "../../domain/src/transaction-categorization.js";
import { type CategorySuggestionProvider } from "../../application/src/ports.js";

export class InMemoryCategorySuggestionProvider implements CategorySuggestionProvider {
  async suggest(input: {
    transaction: {
      description: string;
      direction: "DEBIT" | "CREDIT";
    };
    allowedCategories: ReadonlyArray<Category>;
  }): Promise<{
    category: Category;
    confidence: number;
    rationale: string;
  } | null> {
    const normalized = normalizeMerchantDescription(input.transaction.description);

    if (input.transaction.direction === "CREDIT" && input.allowedCategories.includes("INCOME")) {
      return {
        category: "INCOME",
        confidence: 0.7,
        rationale: "Credit direction suggests incoming funds"
      };
    }

    if (normalized.includes("uber") && input.allowedCategories.includes("TRANSPORTATION")) {
      return {
        category: "TRANSPORTATION",
        confidence: 0.72,
        rationale: "Merchant text resembles ride-share pattern"
      };
    }

    if (input.allowedCategories.includes("UNCATEGORIZED")) {
      return {
        category: "UNCATEGORIZED",
        confidence: 0.2,
        rationale: "No suggestion confidence met threshold"
      };
    }

    return null;
  }
}
