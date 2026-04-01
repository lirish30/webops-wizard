import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ApiErrorCode, ApiErrorEnvelope } from "./api-envelope";

type ContextRequest = FastifyRequest & {
  auditContext?: {
    requestId: string | null;
  };
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Api");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<ContextRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const statusCode = this.getStatusCode(exception);
    const body = this.buildEnvelope(exception, statusCode, request);

    if (statusCode >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId: body.meta.requestId,
          method: request.method,
          path: request.url,
          statusCode,
          errorCode: body.error.code,
          message: body.error.message
        })
      );
    }

    reply.status(statusCode).send(body);
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private buildEnvelope(
    exception: unknown,
    statusCode: number,
    request: ContextRequest
  ): ApiErrorEnvelope {
    const response = exception instanceof HttpException ? exception.getResponse() : null;

    let message = "Unexpected server error.";
    let details: unknown;

    if (typeof response === "string") {
      message = response;
    } else if (response && typeof response === "object") {
      const candidate = response as { message?: unknown; error?: unknown };
      if (typeof candidate.message === "string") {
        message = candidate.message;
      } else if (Array.isArray(candidate.message)) {
        const first = candidate.message.find((item) => typeof item === "string");
        message = typeof first === "string" ? first : message;
        details = candidate.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const code = this.resolveErrorCode(exception, statusCode, message);

    return {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {})
      },
      meta: {
        requestId: request.auditContext?.requestId ?? request.id ?? null,
        timestamp: new Date().toISOString()
      }
    };
  }

  private resolveErrorCode(
    exception: unknown,
    statusCode: number,
    message: string
  ): ApiErrorCode {
    if (exception instanceof UnauthorizedException || statusCode === 401) {
      return "AUTH_REQUIRED";
    }

    if (statusCode === 403) {
      return "FORBIDDEN";
    }

    if (exception instanceof NotFoundException || statusCode === 404) {
      return "NOT_FOUND";
    }

    if (exception instanceof ConflictException || statusCode === 409) {
      return "CONFLICT";
    }

    if (statusCode === 429) {
      return "RATE_LIMITED";
    }

    if (statusCode === 400) {
      const normalized = message.toLowerCase();
      return normalized.includes("invalid") || normalized.includes("required")
        ? "VALIDATION_ERROR"
        : "BAD_REQUEST";
    }

    if (statusCode >= 500) {
      return "INTERNAL_ERROR";
    }

    return "BAD_REQUEST";
  }
}
