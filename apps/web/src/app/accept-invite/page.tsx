"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

import { acceptInvite } from "../../lib/auth-client";

const cardStyle: CSSProperties = {
  width: "min(500px, 100%)",
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

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setErrorMessage("Invite token is missing.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: { token: string; fullName?: string; password?: string } = {
        token
      };
      if (fullName.trim()) {
        payload.fullName = fullName.trim();
      }
      if (password.trim()) {
        payload.password = password.trim();
      }
      await acceptInvite({
        ...payload
      });
      router.replace("/overview");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to accept invite."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Accept workspace invite</h1>
        <p style={{ margin: 0, color: "#5f6d7d" }}>
          If this is your first time, set your profile name and password.
        </p>

        <label>
          <span>Full name (required for new users)</span>
          <input
            style={fieldStyle}
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
          />
        </label>

        <label>
          <span>Password (required for new users)</span>
          <input
            style={fieldStyle}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting || !token}
          style={{
            ...fieldStyle,
            cursor: "pointer",
            background: "#132033",
            color: "white",
            fontWeight: 600
          }}
        >
          {isSubmitting ? "Accepting..." : "Accept invite"}
        </button>

        {!token ? (
          <p style={{ margin: 0, color: "#b91c1c" }}>
            Missing token. Open this page from your invite link.
          </p>
        ) : null}
        {errorMessage ? (
          <p style={{ margin: 0, color: "#b91c1c" }}>{errorMessage}</p>
        ) : null}

        <Link href="/sign-in">Back to sign in</Link>
      </form>
    </main>
  );
}
