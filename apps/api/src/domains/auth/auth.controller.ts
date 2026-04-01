import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { IdentityProviderType } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  buildErrorEnvelopeSchema,
  buildSuccessEnvelopeSchema,
  COOKIE_AUTH_SCHEME
} from "../../common/api/openapi-schemas";
import { parseWithSchema } from "../../common/api/validation";
import { getApiEnv } from "../../config/env";
import { clearSessionCookies, setSessionCookies } from "./auth.cookies";
import {
  acceptInviteSchema,
  createInviteSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema
} from "./auth.schemas";
import { AuthService } from "./auth.service";

@Controller("auth")
@ApiTags("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("providers")
  @ApiOperation({ summary: "List available identity providers" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        providers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", example: "google_oauth" },
              status: { type: "string", example: "coming_soon" }
            }
          }
        }
      }
    })
  })
  async getProviders() {
    const providers = await this.authService.getProviders();
    return { providers };
  }

  @Post("providers/google/start")
  @ApiOperation({ summary: "Start Google OAuth flow (placeholder)" })
  async startGoogleProvider() {
    return this.authService.startProvider(IdentityProviderType.google_oauth);
  }

  @Post("providers/microsoft/start")
  @ApiOperation({ summary: "Start Microsoft OAuth flow (placeholder)" })
  async startMicrosoftProvider() {
    return this.authService.startProvider(IdentityProviderType.microsoft_oauth);
  }

  @Post("sign-up")
  @ApiOperation({ summary: "Create account and authenticated session" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email: { type: "string", format: "email", example: "owner@acme.com" },
        password: { type: "string", minLength: 10, example: "StrongPass123!" },
        fullName: { type: "string", example: "Alex Founder" }
      },
      required: ["email", "password", "fullName"]
    }
  })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        session: { type: "object", additionalProperties: true }
      }
    })
  })
  @ApiBadRequestResponse({ schema: buildErrorEnvelopeSchema() })
  async signUp(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = parseWithSchema(signUpSchema, body);
    const result = await this.authService.signUp(input, request);
    setSessionCookies({
      reply,
      env: getApiEnv(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    return { session: result.session };
  }

  @Post("sign-in")
  @ApiOperation({ summary: "Sign in with email/password" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email: { type: "string", format: "email", example: "owner@acme.com" },
        password: { type: "string", example: "StrongPass123!" }
      },
      required: ["email", "password"]
    }
  })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        session: { type: "object", additionalProperties: true }
      }
    })
  })
  @ApiUnauthorizedResponse({
    schema: buildErrorEnvelopeSchema({ code: "AUTH_REQUIRED", message: "Invalid credentials." })
  })
  async signIn(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = parseWithSchema(signInSchema, body);
    const result = await this.authService.signIn(input, request);
    setSessionCookies({
      reply,
      env: getApiEnv(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    return { session: result.session };
  }

  @Post("sign-out")
  @ApiCookieAuth(COOKIE_AUTH_SCHEME)
  @ApiOperation({ summary: "Sign out and clear auth cookies" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: { success: { type: "boolean", example: true } }
    })
  })
  async signOut(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    await this.authService.signOut(request);
    clearSessionCookies(reply, getApiEnv());
    return { success: true };
  }

  @Post("refresh")
  @ApiCookieAuth(COOKIE_AUTH_SCHEME)
  @ApiOperation({ summary: "Refresh session from refresh cookie" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        session: { type: "object", additionalProperties: true }
      }
    })
  })
  @ApiUnauthorizedResponse({
    schema: buildErrorEnvelopeSchema({ code: "AUTH_REQUIRED", message: "Refresh token missing." })
  })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const result = await this.authService.refresh(request);
    setSessionCookies({
      reply,
      env: getApiEnv(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    return { session: result.session };
  }

  @Get("session")
  @ApiCookieAuth(COOKIE_AUTH_SCHEME)
  @ApiOperation({ summary: "Resolve current authenticated session" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        session: { type: "object", additionalProperties: true }
      }
    })
  })
  async session(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query("allowRefresh") allowRefreshQuery?: string
  ) {
    const allowRefresh = allowRefreshQuery !== "false";
    const result = await this.authService.getSession(request, allowRefresh);

    if ("accessToken" in result) {
      setSessionCookies({
        reply,
        env: getApiEnv(),
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
      return { session: result.session };
    }

    return { session: result };
  }

  @Post("password/forgot")
  @ApiOperation({ summary: "Request password reset token" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email: { type: "string", format: "email", example: "owner@acme.com" }
      },
      required: ["email"]
    }
  })
  async forgotPassword(@Body() body: unknown) {
    const input = parseWithSchema(forgotPasswordSchema, body);
    return this.authService.requestPasswordReset(input);
  }

  @Post("password/reset")
  @ApiOperation({ summary: "Reset password and create new session" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        token: { type: "string", example: "reset_token_abc123" },
        newPassword: { type: "string", example: "NewStrongPass123!" }
      },
      required: ["token", "newPassword"]
    }
  })
  async resetPassword(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = parseWithSchema(resetPasswordSchema, body);
    const result = await this.authService.resetPassword(input, request);
    setSessionCookies({
      reply,
      env: getApiEnv(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    return { session: result.session };
  }

  @Post("invites")
  @ApiCookieAuth(COOKIE_AUTH_SCHEME)
  @ApiOperation({ summary: "Create workspace invite" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" },
        email: { type: "string", format: "email", example: "analyst@acme.com" },
        role: { type: "string", example: "analyst" }
      },
      required: ["workspaceId", "email", "role"]
    }
  })
  async createInvite(@Body() body: unknown, @Req() request: FastifyRequest) {
    const input = parseWithSchema(createInviteSchema, body);
    return this.authService.createInvite(input, request);
  }

  @Post("invites/accept")
  @ApiOperation({ summary: "Accept workspace invite" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        token: { type: "string", example: "invite_token_abc123" },
        fullName: { type: "string", example: "Sam Analyst" },
        password: { type: "string", example: "StrongPass123!" }
      },
      required: ["token"]
    }
  })
  async acceptInvite(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = parseWithSchema(acceptInviteSchema, body);
    const result = await this.authService.acceptInvite(input, request);
    setSessionCookies({
      reply,
      env: getApiEnv(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    return { session: result.session };
  }

  @Post("session/switch-workspace")
  @ApiCookieAuth(COOKIE_AUTH_SCHEME)
  @ApiOperation({ summary: "Switch active workspace for current session" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        workspaceId: { type: "string", format: "uuid" }
      },
      required: ["workspaceId"]
    }
  })
  async switchWorkspace(
    @Body() body: { workspaceId?: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    if (!body?.workspaceId) {
      throw new BadRequestException("workspaceId is required.");
    }
    const result = await this.authService.switchActiveWorkspace(
      request,
      body.workspaceId
    );
    setSessionCookies({
      reply,
      env: getApiEnv(),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    return { session: result.session };
  }
}
