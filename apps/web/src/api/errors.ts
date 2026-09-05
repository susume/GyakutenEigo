export type ApiErrorKind = "network" | "timeout" | "server" | "http";

export class ApiError extends Error {
  public readonly kind: ApiErrorKind;
  public readonly code?: string;
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    public status: number,
    options: { kind?: ApiErrorKind; cause?: unknown; code?: string; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = options.kind ?? (status === 0 ? "network" : "http");
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}
