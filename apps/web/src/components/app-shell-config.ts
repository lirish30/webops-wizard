export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  badge?: string;
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/setup",
    label: "Setup Wizard",
    shortLabel: "SW",
    description: "Guided onboarding, validation, and activation workflow"
  },
  {
    href: "/overview",
    label: "Overview",
    shortLabel: "OV",
    description: "Executive signal, posture, and operating summary"
  },
  {
    href: "/pages",
    label: "Pages",
    shortLabel: "PG",
    description: "Inventory, ownership, and publishing surfaces"
  },
  {
    href: "/recommendations",
    label: "Recommendations",
    shortLabel: "RC",
    description: "Prioritized guidance for fixes and growth",
    badge: "12"
  },
  {
    href: "/data-trust",
    label: "Data Trust",
    shortLabel: "DT",
    description: "Confidence scoring across analytics and attribution"
  },
  {
    href: "/reports",
    label: "Reports",
    shortLabel: "RP",
    description: "Recurring reporting, stakeholder views, and exports"
  },
  {
    href: "/experiments",
    label: "Experiments",
    shortLabel: "EX",
    description: "Learning pipeline for tests and rollout decisions"
  },
  {
    href: "/release-timeline",
    label: "Release Timeline",
    shortLabel: "RT",
    description: "Planned launches, freeze windows, and deployment rhythm"
  },
  {
    href: "/alerts",
    label: "Alerts",
    shortLabel: "AL",
    description: "Operational notifications and escalation monitoring",
    badge: "4"
  },
  {
    href: "/integrations",
    label: "Integrations",
    shortLabel: "IN",
    description: "Connected systems and data contracts"
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "ST",
    description: "Workspace policy, permissions, and defaults"
  }
];
