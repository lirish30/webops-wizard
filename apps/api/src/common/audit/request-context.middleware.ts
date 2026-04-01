import type { NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuditContextRequest } from "./audit.types";

export class RequestContextMiddleware implements NestMiddleware {
  use(request: FastifyRequest, _response: FastifyReply, next: () => void) {
    const typedRequest = request as AuditContextRequest;
    const requestIdHeader = request.headers["x-request-id"];
    const headerRequestId =
      typeof requestIdHeader === "string" ? requestIdHeader : null;

    const workspaceHeader = request.headers["x-workspace-id"];
    const workspaceIdHint = typeof workspaceHeader === "string" ? workspaceHeader : null;
    const cookieHeader = request.headers.cookie ?? "";
    const hasSessionCookie =
      cookieHeader.includes("wow_access=") || cookieHeader.includes("wow_refresh=");

    typedRequest.auditContext = {
      requestId: headerRequestId ?? request.id ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
      workspaceIdHint,
      hasSessionCookie
    };

    next();
  }
}
