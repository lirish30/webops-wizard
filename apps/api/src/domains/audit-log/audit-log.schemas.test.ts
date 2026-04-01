import { describe, expect, it } from "vitest";

import { queryAuditLogSchema } from "./audit-log.schemas";

describe("queryAuditLogSchema", () => {
  it("defaults the limit and parses optional filters", () => {
    const parsed = queryAuditLogSchema.parse({
      category: "membership",
      eventType: "membership.invite_created"
    });

    expect(parsed.limit).toBe(50);
    expect(parsed.category).toBe("membership");
    expect(parsed.eventType).toBe("membership.invite_created");
  });

  it("enforces upper bound on page limit", () => {
    const parse = () => queryAuditLogSchema.parse({ limit: 999 });
    expect(parse).toThrow();
  });
});

