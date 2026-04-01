import type { Metadata } from "next";
import type { ReactNode } from "react";

import { webEnv } from "../lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: webEnv.NEXT_PUBLIC_APP_NAME,
  description: "Governed web operations for modern website teams."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
