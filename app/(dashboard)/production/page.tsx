"use client";

import { Factory } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Production"
      icon={<Factory />}
      description="The production board is scoped out; stage progress is visible on each order."
    />
  );
}
