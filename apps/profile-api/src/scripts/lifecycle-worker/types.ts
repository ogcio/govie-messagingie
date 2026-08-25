export type Success<T> = { success: true; value: T };
export type Failure = { success: false; error: Error };
export type Result<T> = Success<T> | Failure;

export function success<T>(value: T): Success<T> {
  return { success: true, value };
}

export function failed(err: unknown): Failure {
  if (err instanceof Error) {
    return { success: false, error: err };
  }

  if (typeof err === "string") {
    return { success: false, error: new Error(err) };
  }
  return { success: false, error: new Error("unknown error", { cause: err }) };
}

export type Metadata = Record<string, unknown>;
export type AsyncTask = Promise<Result<Metadata | undefined>>;
export type ExportDataMetadata = {
  key: string;
  bucket: string;
  expiresAt: string;
};

export const MAX_RETRY_COUNT = 3;
export const IS_STUCK_AFTER_MINUTES = 60;
