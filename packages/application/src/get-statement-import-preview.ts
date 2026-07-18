import { ZodError, z } from "zod";

import { NotFoundApplicationError, ValidationApplicationError } from "./application-error.js";
import { type StatementImportPreviewRepository } from "./ports.js";

export const getStatementImportPreviewInputSchema = z.object({
  previewId: z.string().min(1),
  accountId: z.string().min(1),
  authenticatedUserId: z.string().min(1)
});

export type GetStatementImportPreviewInput = z.infer<typeof getStatementImportPreviewInputSchema>;

export class GetStatementImportPreviewUseCase {
  constructor(private readonly previewRepository: StatementImportPreviewRepository) {}

  async execute(input: GetStatementImportPreviewInput) {
    let parsed: GetStatementImportPreviewInput;

    try {
      parsed = getStatementImportPreviewInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationApplicationError("Invalid import preview request");
      }
      throw error;
    }

    const preview = await this.previewRepository.findByIdForUser({
      previewId: parsed.previewId,
      ownerUserId: parsed.authenticatedUserId
    });

    if (!preview || preview.accountId !== parsed.accountId) {
      throw new NotFoundApplicationError("Statement import preview not found");
    }

    return preview;
  }
}
