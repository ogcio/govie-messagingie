export class GetTokenError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = "GetTokenError"
  }

  static isGetTokenError(error: unknown): error is GetTokenError {
    return error instanceof Error && error.name === "GetTokenError"
  }
}

export class NoOrganizationError extends Error {
  constructor(public readonly redirectUrl: string) {
    super("No organizations found for the current user")
    this.name = "NoOrganizationError"
  }

  static isNoOrganizationError(error: unknown): error is NoOrganizationError {
    return error instanceof Error && error.name === "NoOrganizationError"
  }
}
