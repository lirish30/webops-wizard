"use client";

import { webEnv } from "./env";
import type {
  AuthSession,
  ProvidersResponse,
  WorkspaceSwitcherResponse
} from "./auth-types";

type ApiError = {
  code?: string;
  message?: string;
};

type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string | null;
    timestamp: string;
  };
};

type ApiErrorEnvelope = {
  success: false;
  error: ApiError;
  meta: {
    requestId: string | null;
    timestamp: string;
  };
};

async function apiFetch<TResponse>(
  path: string,
  options: RequestInit = {}
): Promise<TResponse> {
  const response = await fetch(`${webEnv.NEXT_PUBLIC_API_URL}/api/v1${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const parsed = (await response.json()) as ApiErrorEnvelope;
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }

  const parsed = (await response.json()) as ApiSuccessEnvelope<TResponse>;
  return parsed.data;
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<{ session: AuthSession }> {
  return apiFetch("/auth/sign-in", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ session: AuthSession }> {
  return apiFetch("/auth/sign-up", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function signOut(): Promise<{ success: boolean }> {
  return apiFetch("/auth/sign-out", {
    method: "POST"
  });
}

export async function fetchSession(): Promise<{ session: AuthSession }> {
  return apiFetch("/auth/session");
}

export async function requestPasswordReset(input: {
  email: string;
}): Promise<{ success: boolean; resetLink?: string }> {
  return apiFetch("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
}): Promise<{ session: AuthSession }> {
  return apiFetch("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function acceptInvite(input: {
  token: string;
  fullName?: string;
  password?: string;
}): Promise<{ session: AuthSession }> {
  return apiFetch("/auth/invites/accept", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchProviders(): Promise<ProvidersResponse> {
  return apiFetch("/auth/providers", {
    method: "GET"
  });
}

export async function fetchWorkspaceSwitcher(): Promise<WorkspaceSwitcherResponse> {
  return apiFetch("/workspaces/switcher", {
    method: "GET"
  });
}

export async function switchActiveWorkspace(workspaceId: string): Promise<{ session: AuthSession }> {
  return apiFetch("/auth/session/switch-workspace", {
    method: "POST",
    body: JSON.stringify({ workspaceId })
  });
}

export async function startGoogleSso() {
  return apiFetch<{ status: string; message: string }>("/auth/providers/google/start", {
    method: "POST"
  });
}

export async function startMicrosoftSso() {
  return apiFetch<{ status: string; message: string }>(
    "/auth/providers/microsoft/start",
    {
      method: "POST"
    }
  );
}
