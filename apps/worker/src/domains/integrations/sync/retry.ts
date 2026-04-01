export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
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

export async function runWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt >= policy.maxAttempts) {
        throw error;
      }

      await sleep(policy.baseDelayMs * attempt);
    }
  }

  throw lastError;
}
