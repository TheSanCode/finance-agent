import { parse } from "csv-parse/sync";
import { z } from "zod";

import {
  type ExtractedStatement,
  type StatementExtractor,
  type StatementUploadFile
} from "../../application/src/ports.js";

const parsedRowSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amountMinor: z.string().regex(/^-?\d+$/),
  currency: z.string().length(3),
  statementTotalMinor: z
    .string()
    .regex(/^-?\d+$/)
    .optional()
    .or(z.literal(""))
});

export class CsvStatementExtractor implements StatementExtractor {
  async extract(file: StatementUploadFile): Promise<ExtractedStatement> {
    const content = file.content.toString("utf-8");

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as ReadonlyArray<Record<string, string>>;

    const rows = records.map((record, index) => {
      const parsed = parsedRowSchema.parse(record);
      return {
        rowNumber: index + 2,
        occurredOn: parsed.date,
        description: parsed.description,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency
      };
    });

    const firstTotal = records
      .map((record) => parsedRowSchema.parse(record).statementTotalMinor)
      .find((value) => typeof value === "string" && value.length > 0);

    return {
      rows,
      statementTotalMinor: firstTotal
    };
  }
}
