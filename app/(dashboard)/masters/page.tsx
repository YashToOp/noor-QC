"use client";

import { Boxes } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Masters"
      icon={<Boxes />}
      description="Master data is seeded directly in the shared project."
    />
  );
}
