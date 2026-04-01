export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}

export type RetryObserverEvent =
  | {
      type: "attempt_started";
      attempt: number;
    }
  | {
      type: "attempt_failed";
      attempt: number;
      code?: string;
      retryable: boolean;
    }
  | {
      type: "retry_scheduled";
      attempt: number;
      delayMs: number;
    }
  | {
      type: "rate_limited";
      attempt: number;
      code: string;
    };

export interface RetryObserver {
  onEvent(event: RetryObserverEvent): void | Promise<void>;
}

export class ConnectorExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: { code: string; retryable: boolean }) {
    super(message);
    this.name = "ConnectorExecutionError";
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

export function createRetryPolicy(policy?: Partial<RetryPolicy>): RetryPolicy {
  return {
    maxAttempts: policy?.maxAttempts ?? 3,
    baseDelayMs: policy?.baseDelayMs ?? 200
  };
}

function isRetryableError(error: unknown): error is ConnectorExecutionError {
  return error instanceof ConnectorExecutionError && error.retryable;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitObserverEvent(
  observer: RetryObserver | undefined,
  event: RetryObserverEvent
): void {
  try {
    void Promise.resolve(observer?.onEvent(event)).catch(() => {});
  } catch {
    // Observability must not alter retry behavior.
  }
}

export async function runWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
  observer?: RetryObserver
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    emitObserverEvent(observer, {
      type: "attempt_started",
      attempt
    });

    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableError(error);
      const attemptFailedEvent: RetryObserverEvent = error instanceof ConnectorExecutionError
        ? {
            type: "attempt_failed",
            attempt,
            retryable,
            code: error.code
          }
        : {
            type: "attempt_failed",
            attempt,
            retryable
          };

      emitObserverEvent(observer, attemptFailedEvent);

      if (retryable && error.code === "RATE_LIMIT") {
        emitObserverEvent(observer, {
          type: "rate_limited",
          attempt,
          code: error.code
        });
      }

      if (!retryable || attempt >= policy.maxAttempts) {
        throw error;
      }

      const delayMs = policy.baseDelayMs * attempt;
      emitObserverEvent(observer, {
        type: "retry_scheduled",
        attempt,
        delayMs
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}
