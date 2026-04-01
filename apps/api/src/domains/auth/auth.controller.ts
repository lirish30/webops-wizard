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
import { IdentityProviderType } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

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
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private parseBody<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
    try {
      return schema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues[0]?.message ?? "Invalid request.");
      }
      throw error;
    }
  }

  @Get("providers")
  async getProviders() {
    const providers = await this.authService.getProviders();
    return { providers };
  }

  @Post("providers/google/start")
  async startGoogleProvider() {
    return this.authService.startProvider(IdentityProviderType.google_oauth);
  }

  @Post("providers/microsoft/start")
  async startMicrosoftProvider() {
    return this.authService.startProvider(IdentityProviderType.microsoft_oauth);
  }

  @Post("sign-up")
  async signUp(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = this.parseBody(signUpSchema, body);
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
  async signIn(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = this.parseBody(signInSchema, body);
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
  async signOut(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    await this.authService.signOut(request);
    clearSessionCookies(reply, getApiEnv());
    return { success: true };
  }

  @Post("refresh")
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
  async forgotPassword(@Body() body: unknown) {
    const input = this.parseBody(forgotPasswordSchema, body);
    return this.authService.requestPasswordReset(input);
  }

  @Post("password/reset")
  async resetPassword(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = this.parseBody(resetPasswordSchema, body);
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
  async createInvite(@Body() body: unknown, @Req() request: FastifyRequest) {
    const input = this.parseBody(createInviteSchema, body);
    return this.authService.createInvite(input, request);
  }

  @Post("invites/accept")
  async acceptInvite(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = this.parseBody(acceptInviteSchema, body);
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
  async switchWorkspace(
    @Body() body: { workspaceId?: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    if (!body.workspaceId) {
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
