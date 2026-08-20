"use client";

import { Settings2 } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Users & roles"
      icon={<Settings2 />}
      description="There is no auth in this build; the operator is hardcoded."
    />
  );
}
