import { describe, expect, it } from "vitest";

import { domainNames } from "./domain";

describe("shared contracts", () => {
  it("keeps the expected modular monolith domains", () => {
    expect(domainNames).toContain("page-intelligence");
    expect(domainNames).toContain("data-trust");
    expect(domainNames).toContain("recommendations");
  });
});
