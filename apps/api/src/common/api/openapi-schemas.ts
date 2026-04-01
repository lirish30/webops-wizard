export const COOKIE_AUTH_SCHEME = "cookieAuth";

export function buildSuccessEnvelopeSchema(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      success: { type: "boolean", enum: [true] },
      data: dataSchema,
      meta: {
        type: "object",
        properties: {
          requestId: { type: "string", nullable: true, example: "req_123" },
          timestamp: { type: "string", format: "date-time" }
        },
        required: ["requestId", "timestamp"]
      }
    },
    required: ["success", "data", "meta"]
  };
}

export function buildErrorEnvelopeSchema(params?: {
  code?: string;
  message?: string;
  detailsSchema?: Record<string, unknown>;
}) {
  return {
    type: "object",
    properties: {
      success: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: params?.code ?? "VALIDATION_ERROR" },
          message: { type: "string", example: params?.message ?? "Invalid request." },
          ...(params?.detailsSchema ? { details: params.detailsSchema } : {})
        },
        required: ["code", "message"]
      },
      meta: {
        type: "object",
        properties: {
          requestId: { type: "string", nullable: true, example: "req_123" },
          timestamp: { type: "string", format: "date-time" }
        },
        required: ["requestId", "timestamp"]
      }
    },
    required: ["success", "error", "meta"]
  };
}
