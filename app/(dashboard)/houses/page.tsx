"use client";

import { Building2 } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Houses"
      icon={<Building2 />}
      description="House records and scores are seeded and read-only in this build."
    />
  );
}
