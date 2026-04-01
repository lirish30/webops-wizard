"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  fetchProviders,
  fetchSession,
  signIn,
  startGoogleSso,
  startMicrosoftSso
} from "../../lib/auth-client";
import type { ProvidersResponse } from "../../lib/auth-types";

const cardStyle: CSSProperties = {
  width: "min(460px, 100%)",
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "1rem",
  border: "1px solid rgba(0,0,0,0.1)",
  background: "rgba(255,255,255,0.85)"
};

const fieldStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: "0.6rem",
  padding: "0.7rem 0.75rem"
};

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProvidersResponse["providers"]>([]);

  useEffect(() => {
    void fetchSession()
      .then(() => router.replace("/overview"))
      .catch(() => undefined);
    void fetchProviders()
      .then((result) => setProviders(result.providers))
      .catch(() => undefined);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setProviderMessage(null);

    try {
      await signIn({ email, password });
      router.replace("/overview");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleProviderStart(provider: "google" | "microsoft") {
    setProviderMessage(null);
    setErrorMessage(null);
    try {
      const result =
        provider === "google" ? await startGoogleSso() : await startMicrosoftSso();
      setProviderMessage(result.message);
    } catch (error) {
      setProviderMessage(
        error instanceof Error ? error.message : "Provider start failed."
      );
    }
  }

  const googleStatus =
    providers.find((provider) => provider.type === "google_oauth")?.status ??
    "coming_soon";
  const microsoftStatus =
    providers.find((provider) => provider.type === "microsoft_oauth")?.status ??
    "coming_soon";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem"
      }}
    >
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Sign in to WebOps Wizard</h1>
          <p style={{ margin: 0, color: "#5f6d7d" }}>
            Use your email and password. SSO is wired as provider placeholders.
          </p>
        </div>

        <label>
          <span>Email</span>
          <input
            style={fieldStyle}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          <span>Password</span>
          <input
            style={fieldStyle}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            ...fieldStyle,
            cursor: "pointer",
            background: "#132033",
            color: "white",
            fontWeight: 600
          }}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => handleProviderStart("google")}
            style={fieldStyle}
          >
            Continue with Google ({googleStatus})
          </button>
          <button
            type="button"
            onClick={() => handleProviderStart("microsoft")}
            style={fieldStyle}
          >
            Continue with Microsoft ({microsoftStatus})
          </button>
        </div>

        {errorMessage ? (
          <p style={{ margin: 0, color: "#b91c1c" }}>{errorMessage}</p>
        ) : null}
        {providerMessage ? (
          <p style={{ margin: 0, color: "#92400e" }}>{providerMessage}</p>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/sign-up">Create account</Link>
        </div>
      </form>
    </main>
  );
}
