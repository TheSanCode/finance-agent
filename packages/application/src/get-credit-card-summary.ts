import { ZodError, z } from "zod";

import { calculateCreditCardSummary } from "../../domain/src/credit-card-summary.js";
import {
  NotFoundApplicationError,
  UnauthorizedApplicationError,
  ValidationApplicationError
} from "./application-error.js";
import { type CreditCardAccountReadRepository } from "./ports.js";

export const getCreditCardSummaryInputSchema = z.object({
  accountId: z.string().min(1),
  authenticatedUserId: z.string().min(1)
});

export type GetCreditCardSummaryInput = z.infer<typeof getCreditCardSummaryInputSchema>;

export type GetCreditCardSummaryOutput = {
  readonly accountId: string;
  readonly currency: string;
  readonly creditLimitMinor: string;
  readonly currentBalanceMinor: string;
  readonly availableCreditMinor: string;
  readonly utilizationBasisPoints: string;
};

export class GetCreditCardSummaryUseCase {
  constructor(private readonly creditCardReadRepository: CreditCardAccountReadRepository) {}

  async execute(input: GetCreditCardSummaryInput): Promise<GetCreditCardSummaryOutput> {
    let parsedInput: GetCreditCardSummaryInput;

    try {
      parsedInput = getCreditCardSummaryInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid credit card summary request");
      }
      throw error;
    }

    if (!parsedInput.authenticatedUserId) {
      throw new UnauthorizedApplicationError();
    }

    const account = await this.creditCardReadRepository.findByAccountIdForUser({
      accountId: parsedInput.accountId,
      ownerUserId: parsedInput.authenticatedUserId
    });

    if (!account) {
      throw new NotFoundApplicationError("Credit card account not found");
    }

    const summary = calculateCreditCardSummary(account);

    return {
      accountId: summary.accountId,
      currency: summary.currency,
      creditLimitMinor: summary.creditLimit.amountMinor.toString(),
      currentBalanceMinor: summary.currentBalance.amountMinor.toString(),
      availableCreditMinor: summary.availableCredit.amountMinor.toString(),
      utilizationBasisPoints: summary.utilizationBasisPoints.toString()
    };
  }
}
