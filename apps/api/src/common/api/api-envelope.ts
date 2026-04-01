export type ApiSuccessEnvelope<TData> = {
  success: true;
  data: TData;
  meta: {
    requestId: string | null;
    timestamp: string;
  };
};

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ApiErrorEnvelope = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string | null;
    timestamp: string;
  };
};
