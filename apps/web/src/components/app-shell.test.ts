import { describe, expect, it } from "vitest";

import { navigationItems } from "./app-shell-config";

describe("navigationItems", () => {
  it("defines the primary app destinations in product order", () => {
    expect(
      navigationItems.map((item) => ({
        href: item.href,
        label: item.label
      }))
    ).toEqual([
      { href: "/overview", label: "Overview" },
      { href: "/pages", label: "Pages" },
      { href: "/recommendations", label: "Recommendations" },
      { href: "/data-trust", label: "Data Trust" },
      { href: "/reports", label: "Reports" },
      { href: "/experiments", label: "Experiments" },
      { href: "/release-timeline", label: "Release Timeline" },
      { href: "/alerts", label: "Alerts" },
      { href: "/integrations", label: "Integrations" },
      { href: "/settings", label: "Settings" }
    ]);
  });
});
