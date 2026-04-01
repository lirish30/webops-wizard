import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        border: "1px solid #1f2937",
        borderRadius: "999px",
        padding: "0.75rem 1rem",
        background: "#111827",
        color: "#f9fafb",
        fontWeight: 600
      }}
    >
      {children}
    </button>
  );
}
