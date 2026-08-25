export class TimeoutError extends Error {
  readonly timeoutMs: number;
  readonly label: string;

  constructor(label: string, timeoutMs: number) {
    super(`Operation "${label}" timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Races a promise against a timeout. If the timeout fires first the returned
 * promise rejects with a {@link TimeoutError}, which unblocks the caller even
 * when the underlying work never settles (e.g. a stalled network read).
 *
 * `onTimeout` lets the caller release the underlying resource (destroy a
 * stream, abort a request) so the timed-out work does not leak. Note the
 * original promise is intentionally not awaited after a timeout.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        onTimeout?.();
      } finally {
        reject(new TimeoutError(label, timeoutMs));
      }
    }, timeoutMs);

    // Do not keep the event loop alive solely for this timer.
    timer.unref?.();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
