import type { SessionMembership, WorkspaceSwitcherItem } from "../lib/auth-types";

export function getRoleBadgeLabel(
  role: SessionMembership["role"] | "member"
): string {
  if (role === "external_stakeholder") {
    return "External";
  }
  if (role === "agency_manager") {
    return "Agency Manager";
  }
  if (role === "client_viewer") {
    return "Client Viewer";
  }
  return role.replace("_", " ");
}

export function filterWorkspaces(items: WorkspaceSwitcherItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return items;
  }
  return items.filter((item) => {
    return (
      item.workspaceName.toLowerCase().includes(normalizedQuery) ||
      item.workspaceSlug.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function buildRecentWorkspaces(items: WorkspaceSwitcherItem[]) {
  return items
    .filter((workspace) => workspace.lastActiveAt !== null)
    .slice(0, 5);
}

