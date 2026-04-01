import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Observable, map, tap } from "rxjs";

import type { ApiSuccessEnvelope } from "./api-envelope";

type LoggedRequest = FastifyRequest & {
  auditContext?: {
    requestId: string | null;
    workspaceIdHint: string | null;
    hasSessionCookie: boolean;
  };
};

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessEnvelope<T>>
{
  private readonly logger = new Logger("Api");

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ApiSuccessEnvelope<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<LoggedRequest>();
    const reply = http.getResponse<FastifyReply>();
    const startedAt = Date.now();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        meta: {
          requestId: request.auditContext?.requestId ?? request.id ?? null,
          timestamp: new Date().toISOString()
        }
      })),
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              requestId: request.auditContext?.requestId ?? request.id ?? null,
              method: request.method,
              path: request.url,
              statusCode: reply.statusCode,
              durationMs: Date.now() - startedAt,
              workspaceIdHint: request.auditContext?.workspaceIdHint ?? null,
              hasSessionCookie: request.auditContext?.hasSessionCookie ?? false
            })
          );
        },
        error: () => {
          this.logger.warn(
            JSON.stringify({
              requestId: request.auditContext?.requestId ?? request.id ?? null,
              method: request.method,
              path: request.url,
              statusCode: reply.statusCode,
              durationMs: Date.now() - startedAt,
              workspaceIdHint: request.auditContext?.workspaceIdHint ?? null,
              hasSessionCookie: request.auditContext?.hasSessionCookie ?? false
            })
          );
        }
      })
    );
  }
}
