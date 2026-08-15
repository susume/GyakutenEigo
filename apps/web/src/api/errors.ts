export type ApiErrorKind = "network" | "timeout" | "server" | "http";

export class ApiError extends Error {
  public readonly kind: ApiErrorKind;

  constructor(
    message: string,
    public status: number,
    options: { kind?: ApiErrorKind; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = options.kind ?? (status === 0 ? "network" : "http");
    if (options.cause !== undefined) this.cause = options.cause;
  }
}
