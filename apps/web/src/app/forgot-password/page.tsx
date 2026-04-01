"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

import { requestPasswordReset } from "../../lib/auth-client";

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResponseMessage(null);
    setResetLink(null);

    try {
      const result = await requestPasswordReset({ email });
      setResponseMessage(
        "If that account exists, a reset link has been generated."
      );
      if (result.resetLink) {
        setResetLink(result.resetLink);
      }
    } catch (error) {
      setResponseMessage(
        error instanceof Error
          ? error.message
          : "Unable to process reset request."
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
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Reset your password</h1>
        <p style={{ margin: 0, color: "#5f6d7d" }}>
          Enter your email and we will generate a reset link.
        </p>

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
          {isSubmitting ? "Submitting..." : "Send reset link"}
        </button>

        {responseMessage ? (
          <p style={{ margin: 0, color: "#1d4ed8" }}>{responseMessage}</p>
        ) : null}
        {resetLink ? (
          <p style={{ margin: 0 }}>
            Development reset link: <a href={resetLink}>{resetLink}</a>
          </p>
        ) : null}

        <Link href="/sign-in">Back to sign in</Link>
      </form>
    </main>
  );
}
