export type ApplicationErrorCode =
  "validation_error" | "unauthorized" | "not_found" | "internal_error";

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class ValidationApplicationError extends ApplicationError {
  constructor(message: string) {
    super("validation_error", message);
  }
}

export class UnauthorizedApplicationError extends ApplicationError {
  constructor(message = "Unauthorized") {
    super("unauthorized", message);
  }
}

export class NotFoundApplicationError extends ApplicationError {
  constructor(message = "Resource not found") {
    super("not_found", message);
  }
}
