import { describe, expect, it } from "vitest";

import { sendReportSchema } from "./reports.dto";

describe("Reports DTO", () => {
  it("parses send report payload", () => {
    const parsed = sendReportSchema.parse({
      reportName: "Weekly Summary",
      recipients: ["ops@example.com"]
    });
    expect(parsed.reportName).toBe("Weekly Summary");
    expect(parsed.recipients).toHaveLength(1);
  });
});
