"use client";

import { Users } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Clients"
      icon={<Users />}
      description="Client records are seeded and read-only in this build."
    />
  );
}
