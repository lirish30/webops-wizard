import { EmptyState } from "../../../components/empty-state";

export default function PagesExplorerPage() {
  return (
    <EmptyState
      eyebrow="Pages"
      title="Inventory the pages that drive traffic, revenue, and risk"
      description="See which pages exist, who owns them, what changed, and where quality or governance checks are missing."
      primaryAction="Import page inventory"
      secondaryAction="Define ownership model"
      stats={[
        { label: "Tracked pages", value: "0 indexed" },
        { label: "Ownership coverage", value: "0%" },
        { label: "Critical templates", value: "6 planned" }
      ]}
    />
  );
}
