import { EmptyState } from "../../../components/empty-state";

export default function DataTrustPage() {
  return (
    <EmptyState
      eyebrow="Data Trust"
      title="Validate the data before it shapes the roadmap"
      description="Track confidence across analytics, consent coverage, event quality, and attribution drift before teams act on noisy signals."
      primaryAction="Connect signal checks"
      secondaryAction="Review trust policy"
      stats={[
        { label: "Trusted sources", value: "0 connected" },
        { label: "Coverage target", value: "98%" },
        { label: "Integrity issues", value: "3 open" }
      ]}
    />
  );
}
