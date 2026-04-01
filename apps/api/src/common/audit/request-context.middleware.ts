import type { NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuditContextRequest } from "./audit.types";

export class RequestContextMiddleware implements NestMiddleware {
  use(request: FastifyRequest, _response: FastifyReply, next: () => void) {
    const typedRequest = request as AuditContextRequest;
    const requestIdHeader = request.headers["x-request-id"];
    const headerRequestId =
      typeof requestIdHeader === "string" ? requestIdHeader : null;

    typedRequest.auditContext = {
      requestId: headerRequestId ?? request.id ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null
    };

    next();
  }
}

