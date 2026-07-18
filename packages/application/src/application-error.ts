export type ApplicationErrorCode =
  | "validation_error"
  | "unauthorized"
  | "not_found"
  | "internal_error"
  | "unsupported_media_type"
  | "payload_too_large"
  | "conflict"
  | "invalid_state";

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

export class UnsupportedMediaTypeApplicationError extends ApplicationError {
  constructor(message = "Unsupported media type") {
    super("unsupported_media_type", message);
  }
}

export class PayloadTooLargeApplicationError extends ApplicationError {
  constructor(message = "Payload too large") {
    super("payload_too_large", message);
  }
}

export class ConflictApplicationError extends ApplicationError {
  constructor(message = "Conflict") {
    super("conflict", message);
  }
}

export class InvalidStateApplicationError extends ApplicationError {
  constructor(message = "Invalid state") {
    super("invalid_state", message);
  }
}
