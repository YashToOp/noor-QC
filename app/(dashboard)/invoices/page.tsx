"use client";

import { Receipt } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Invoices"
      icon={<Receipt />}
      description="Invoicing is owned by this dashboard, but was scoped out of this build."
    />
  );
}
