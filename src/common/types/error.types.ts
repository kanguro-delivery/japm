/**
 * Helper types for safe error handling
 */

export interface ErrorLike {
  message: string;
  stack?: string;
  name?: string;
  code?: string;
}

/**
 * Type guard to check if an error has the expected properties
 */
export function isErrorLike(error: unknown): error is ErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorLike(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Safely extract error stack from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isErrorLike(error) && error.stack) {
    return error.stack;
  }
  return undefined;
}

/**
 * Convert unknown error to ErrorLike object
 */
export function toErrorLike(error: unknown): ErrorLike {
  if (isErrorLike(error)) {
    return error;
  }

  return {
    message: getErrorMessage(error),
    stack: getErrorStack(error),
    name:
      typeof error === 'object' && error !== null && 'name' in error
        ? String((error as any).name)
        : 'UnknownError',
  };
}
