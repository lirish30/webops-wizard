export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "invited" | "suspended";
};

export type SessionMembership = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role:
    | "owner"
    | "admin"
    | "manager"
    | "analyst"
    | "viewer"
    | "external_stakeholder"
    | "agency_manager"
    | "client_viewer";
};

export type AuthSession = {
  user: SessionUser;
  activeWorkspaceId: string | null;
  memberships: SessionMembership[];
};

export type WorkspaceSwitcherItem = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: SessionMembership["role"];
  lastActiveAt: string | null;
  isActive: boolean;
};

export type WorkspaceSwitcherResponse = {
  activeWorkspaceId: string | null;
  recentWorkspaces: WorkspaceSwitcherItem[];
  workspaces: WorkspaceSwitcherItem[];
};

export type ProvidersResponse = {
  providers: Array<{
    type: "local" | "google_oauth" | "microsoft_oauth" | "saml";
    label: string;
    status: "enabled" | "disabled" | "coming_soon";
  }>;
};
