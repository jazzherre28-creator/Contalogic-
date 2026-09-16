import { createFileRoute } from "@tanstack/react-router";
import { TaxRemindersBoard } from "@/components/TaxRemindersBoard";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return <TaxRemindersBoard />;
}
