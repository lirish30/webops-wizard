"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";

import { fetchSession, signUp } from "../../lib/auth-client";

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

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchSession()
      .then(() => router.replace("/overview"))
      .catch(() => undefined);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await signUp({ fullName, email, password });
      router.replace("/overview");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create account.");
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
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Create your account</h1>
          <p style={{ margin: 0, color: "#5f6d7d" }}>
            Sign up with email/password and get a personal default workspace.
          </p>
        </div>

        <label>
          <span>Full name</span>
          <input
            style={fieldStyle}
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            autoComplete="name"
          />
        </label>

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
            minLength={8}
            autoComplete="new-password"
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
          {isSubmitting ? "Creating..." : "Create account"}
        </button>

        {errorMessage ? (
          <p style={{ margin: 0, color: "#b91c1c" }}>{errorMessage}</p>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <Link href="/sign-in">Already have an account?</Link>
          <Link href="/forgot-password">Forgot password</Link>
        </div>
      </form>
    </main>
  );
}
