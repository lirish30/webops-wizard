import { EmptyState } from "../../../components/empty-state";

export default function RecommendationsPage() {
  return (
    <EmptyState
      eyebrow="Recommendations"
      title="Turn noisy website feedback into ranked operational actions"
      description="Bring together opportunities from search, analytics, governance, and conversion into a single recommendation board with clear expected impact."
      primaryAction="Generate recommendations"
      secondaryAction="Tune scoring model"
      stats={[
        { label: "Priority queue", value: "12 items" },
        { label: "Expected lift", value: "+8.4%" },
        { label: "Owners assigned", value: "3 teams" }
      ]}
    />
  );
}
