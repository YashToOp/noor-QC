"use client";

import { Banknote } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Payments"
      icon={<Banknote />}
      description="Payments are owned by this dashboard, but were scoped out of this build."
    />
  );
}
