import React from "react";
import { PnLDisplay } from "@/components/PnLDisplay";
import { BalanceDisplay } from "@/components/BalanceDisplay";

export function DashboardPanels() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PnLDisplay />
      <BalanceDisplay />
    </div>
  );
}
