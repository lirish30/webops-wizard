import type { FastifyReply, FastifyRequest } from "fastify";

import type { ApiEnv } from "../../config/env";

const ACCESS_COOKIE_NAME = "wow_access";
const REFRESH_COOKIE_NAME = "wow_refresh";

type CookieOptions = {
  maxAgeSeconds: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
};

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `Path=${options.path ?? "/"}`
  ];

  if (options.httpOnly ?? true) {
    parts.push("HttpOnly");
  }
  if (options.secure ?? false) {
    parts.push("Secure");
  }
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  return parts.join("; ");
}

function appendSetCookie(reply: FastifyReply, cookieValues: string[]) {
  reply.header("Set-Cookie", cookieValues);
}

export function setSessionCookies(params: {
  reply: FastifyReply;
  env: ApiEnv;
  accessToken: string;
  refreshToken: string;
}) {
  const { reply, env, accessToken, refreshToken } = params;
  const secure = env.NODE_ENV === "production";

  appendSetCookie(reply, [
    serializeCookie(ACCESS_COOKIE_NAME, accessToken, {
      maxAgeSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      secure
    }),
    serializeCookie(REFRESH_COOKIE_NAME, refreshToken, {
      maxAgeSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
      secure
    })
  ]);
}

export function clearSessionCookies(reply: FastifyReply, env: ApiEnv) {
  const secure = env.NODE_ENV === "production";

  appendSetCookie(reply, [
    serializeCookie(ACCESS_COOKIE_NAME, "", {
      maxAgeSeconds: 0,
      secure
    }),
    serializeCookie(REFRESH_COOKIE_NAME, "", {
      maxAgeSeconds: 0,
      secure
    })
  ]);
}

export function getCookieValue(request: FastifyRequest, cookieName: string): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookiePairs = cookieHeader.split(";").map((value: string) => value.trim());
  for (const pair of cookiePairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = pair.slice(0, separatorIndex);
    const rawValue = pair.slice(separatorIndex + 1);
    if (name === cookieName) {
      return decodeURIComponent(rawValue);
    }
  }

  return null;
}

export function getAccessTokenCookie(request: FastifyRequest): string | null {
  return getCookieValue(request, ACCESS_COOKIE_NAME);
}

export function getRefreshTokenCookie(request: FastifyRequest): string | null {
  return getCookieValue(request, REFRESH_COOKIE_NAME);
}
