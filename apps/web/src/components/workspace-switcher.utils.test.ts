import { describe, expect, it } from "vitest";

import {
  buildRecentWorkspaces,
  filterWorkspaces,
  getRoleBadgeLabel
} from "./workspace-switcher.utils";

const fixtures = [
  {
    workspaceId: "w-1",
    workspaceName: "Acme Core",
    workspaceSlug: "acme-core",
    role: "owner" as const,
    isActive: true,
    lastActiveAt: "2026-04-01T08:00:00.000Z"
  },
  {
    workspaceId: "w-2",
    workspaceName: "Beta Client",
    workspaceSlug: "beta-client",
    role: "client_viewer" as const,
    isActive: false,
    lastActiveAt: "2026-03-29T08:00:00.000Z"
  },
  {
    workspaceId: "w-3",
    workspaceName: "Gamma Sandbox",
    workspaceSlug: "gamma-sandbox",
    role: "analyst" as const,
    isActive: false,
    lastActiveAt: null
  }
];

describe("workspace switcher utils", () => {
  it("filters by workspace name and slug", () => {
    expect(filterWorkspaces(fixtures, "beta")).toHaveLength(1);
    expect(filterWorkspaces(fixtures, "sandbox")).toHaveLength(1);
    expect(filterWorkspaces(fixtures, "missing")).toHaveLength(0);
  });

  it("builds recents from last active values only", () => {
    const recents = buildRecentWorkspaces(fixtures);
    expect(recents).toHaveLength(2);
    expect(recents.map((item) => item.workspaceId)).toEqual(["w-1", "w-2"]);
  });

  it("formats role labels for badges", () => {
    expect(getRoleBadgeLabel("agency_manager")).toBe("Agency Manager");
    expect(getRoleBadgeLabel("client_viewer")).toBe("Client Viewer");
    expect(getRoleBadgeLabel("manager")).toBe("manager");
  });
});

