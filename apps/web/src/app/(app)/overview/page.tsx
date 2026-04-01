import { EmptyState } from "../../../components/empty-state";

export default function OverviewPage() {
  return (
    <EmptyState
      eyebrow="Overview"
      title="Operate every site change from one governed command layer"
      description="WebOps Wizard unifies content health, release readiness, data trust, and stakeholder reporting into a single operating view for modern website teams."
      primaryAction="Create first workspace brief"
      secondaryAction="Invite collaborators"
      stats={[
        { label: "Active properties", value: "1 seeded" },
        { label: "Recommendations", value: "12 queued" },
        { label: "Release readiness", value: "87%" }
      ]}
    >
      <ul>
        <li>Use this overview to prioritize the next action across SEO, data, and releases.</li>
        <li>Promote the most urgent recommendation into the active work queue.</li>
        <li>Track whether the property is safe to ship before launch day.</li>
      </ul>
    </EmptyState>
  );
}
