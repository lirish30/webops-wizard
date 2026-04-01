import Link from "next/link";

import { Button } from "@webops-wizard/ui";
import { domainNames } from "@webops-wizard/types";

export default function HomePage() {
  return (
    <main style={{ padding: "3rem", display: "grid", gap: "1.5rem" }}>
      <section style={{ display: "grid", gap: "0.75rem", maxWidth: "48rem" }}>
        <p
          style={{ margin: 0, fontSize: "0.875rem", textTransform: "uppercase" }}
        >
          WebOps Wizard Foundation
        </p>
        <h1 style={{ margin: 0, fontSize: "3rem", lineHeight: 1 }}>
          Governed web operations, scaffolded for scale.
        </h1>
        <p style={{ margin: 0, fontSize: "1.125rem", color: "#4b5563" }}>
          This monorepo starts as a modular monolith and keeps clean seams for
          future service extraction.
        </p>
      </section>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/overview">
          <Button>Open MVP surfaces</Button>
        </Link>
      </div>

      <section>
        <h2>Scaffolded Domains</h2>
        <ul>
          {domainNames.map((domain) => (
            <li key={domain}>{domain}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
