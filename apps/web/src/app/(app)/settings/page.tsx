import { EmptyState } from "../../../components/empty-state";

export default function SettingsPage() {
  return (
    <EmptyState
      eyebrow="Settings"
      title="Set the operating rules for how the workspace behaves"
      description="Manage permissions, naming, defaults, notifications, and governance policy so every property follows the same control plane."
      primaryAction="Review workspace policy"
      secondaryAction="Adjust user roles"
      stats={[
        { label: "Admins", value: "2 members" },
        { label: "Policies active", value: "9 rules" },
        { label: "Audit cadence", value: "Weekly" }
      ]}
    />
  );
}
