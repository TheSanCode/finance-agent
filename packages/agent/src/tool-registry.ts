import { type ZodType } from "zod";

type ToolName = "draft-journal-entry" | "get-health-status";

type ToolContext = {
  readonly actorId: string;
};

type ToolHandler<Input, Output> = {
  readonly inputSchema: ZodType<Input>;
  readonly run: (input: Input, context: ToolContext) => Promise<Output>;
};

export class ControlledToolRegistry {
  private readonly tools = new Map<ToolName, ToolHandler<unknown, unknown>>();

  register<Input, Output>(name: ToolName, handler: ToolHandler<Input, Output>): void {
    if (this.tools.has(name)) {
      throw new Error(`Tool already registered: ${name}`);
    }
    this.tools.set(name, handler as ToolHandler<unknown, unknown>);
  }

  async execute(name: ToolName, rawInput: unknown, context: ToolContext): Promise<unknown> {
    const handler = this.tools.get(name);
    if (!handler) {
      throw new Error(`Tool not allowed: ${name}`);
    }

    const parsedInput = handler.inputSchema.parse(rawInput);
    return handler.run(parsedInput, context);
  }
}
