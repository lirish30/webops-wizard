import { MembershipRole } from "@prisma/client";

export const workspaceCapabilities = [
  "workspace.read",
  "workspace.update",
  "workspace.memberships.read",
  "workspace.memberships.manage",
  "workspace.invites.manage",
  "property.read",
  "property.write",
  "integration.read",
  "integration.manage",
  "reports.read",
  "reports.send",
  "recommendations.read",
  "ai.generate",
  "approval.manage",
  "alerts.read",
  "releases.read",
  "page_intelligence.read",
  "data_trust.read",
  "settings.read",
  "settings.manage",
  "audit.read"
] as const;

export type WorkspaceCapability = (typeof workspaceCapabilities)[number];

const allCapabilities = new Set<WorkspaceCapability>(workspaceCapabilities);

const roleCapabilityMap: Record<MembershipRole, Set<WorkspaceCapability>> = {
  [MembershipRole.owner]: allCapabilities,
  [MembershipRole.admin]: allCapabilities,
  [MembershipRole.agency_manager]: new Set<WorkspaceCapability>([
    "workspace.read",
    "workspace.memberships.read",
    "workspace.invites.manage",
    "property.read",
    "property.write",
    "integration.read",
    "integration.manage",
    "reports.read",
    "reports.send",
    "recommendations.read",
    "ai.generate",
    "approval.manage",
    "alerts.read",
    "releases.read",
    "page_intelligence.read",
    "data_trust.read",
    "settings.read",
    "audit.read"
  ]),
  [MembershipRole.manager]: new Set<WorkspaceCapability>([
    "workspace.read",
    "workspace.memberships.read",
    "property.read",
    "property.write",
    "integration.read",
    "integration.manage",
    "reports.read",
    "reports.send",
    "recommendations.read",
    "ai.generate",
    "approval.manage",
    "alerts.read",
    "releases.read",
    "page_intelligence.read",
    "data_trust.read",
    "settings.read",
    "audit.read"
  ]),
  [MembershipRole.analyst]: new Set<WorkspaceCapability>([
    "workspace.read",
    "property.read",
    "integration.read",
    "reports.read",
    "reports.send",
    "recommendations.read",
    "ai.generate",
    "alerts.read",
    "releases.read",
    "page_intelligence.read",
    "data_trust.read",
    "settings.read",
    "audit.read"
  ]),
  [MembershipRole.viewer]: new Set<WorkspaceCapability>([
    "workspace.read",
    "property.read",
    "integration.read",
    "reports.read",
    "recommendations.read",
    "alerts.read",
    "releases.read",
    "page_intelligence.read",
    "data_trust.read"
  ]),
  [MembershipRole.external_stakeholder]: new Set<WorkspaceCapability>([
    "workspace.read",
    "reports.read",
    "recommendations.read",
    "releases.read"
  ]),
  [MembershipRole.client_viewer]: new Set<WorkspaceCapability>([
    "workspace.read",
    "reports.read",
    "recommendations.read",
    "releases.read"
  ])
};

export function hasWorkspaceCapability(
  role: MembershipRole,
  capability: WorkspaceCapability
): boolean {
  return roleCapabilityMap[role].has(capability);
}

export function listWorkspaceCapabilities(role: MembershipRole): WorkspaceCapability[] {
  return [...roleCapabilityMap[role]];
}
