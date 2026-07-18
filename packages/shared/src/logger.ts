export type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

type LoggerContext = {
  readonly service: string;
};

export type Logger = {
  debug: (event: string, payload?: LogPayload) => void;
  info: (event: string, payload?: LogPayload) => void;
  warn: (event: string, payload?: LogPayload) => void;
  error: (event: string, payload?: LogPayload) => void;
};

const emitLog = (
  level: LogLevel,
  context: LoggerContext,
  event: string,
  payload: LogPayload
): void => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: context.service,
    event,
    ...payload
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
};

export const createLogger = (context: LoggerContext): Logger => ({
  debug: (event, payload = {}) => emitLog("debug", context, event, payload),
  info: (event, payload = {}) => emitLog("info", context, event, payload),
  warn: (event, payload = {}) => emitLog("warn", context, event, payload),
  error: (event, payload = {}) => emitLog("error", context, event, payload)
});
