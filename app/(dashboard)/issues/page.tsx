"use client";

import { AlertTriangle } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Issues"
      icon={<AlertTriangle />}
      description="Issue resolution is owned by this dashboard, but was scoped out of this build."
    />
  );
}
