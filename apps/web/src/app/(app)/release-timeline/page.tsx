import { EmptyState } from "../../../components/empty-state";

export default function ReleaseTimelinePage() {
  return (
    <EmptyState
      eyebrow="Release Timeline"
      title="Coordinate launches with risk, trust, and stakeholder timing"
      description="Use one operating timeline for freeze windows, launches, experiment milestones, and post-release checks."
      primaryAction="Schedule release"
      secondaryAction="Open calendar rules"
      stats={[
        { label: "Upcoming releases", value: "0 scheduled" },
        { label: "Freeze windows", value: "2 saved" },
        { label: "Teams aligned", value: "4 functions" }
      ]}
    />
  );
}
