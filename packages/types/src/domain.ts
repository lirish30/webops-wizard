export const domainNames = [
  "auth",
  "workspaces",
  "properties",
  "integrations",
  "page-intelligence",
  "data-trust",
  "recommendations",
  "reports",
  "alerts",
  "releases",
  "settings"
] as const;

export type DomainName = (typeof domainNames)[number];

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "manager"
  | "analyst"
  | "viewer"
  | "external_stakeholder"
  | "agency_manager"
  | "client_viewer";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface PropertySummary {
  id: string;
  workspaceId: string;
  name: string;
  primaryDomain: string;
  environment: "sandbox" | "staging" | "production";
}
