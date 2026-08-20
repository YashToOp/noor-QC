"use client";

import { Palette } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Samples & shades"
      icon={<Palette />}
      description="Sample and shade gates need a gate_type column that the shared schema does not have yet."
    />
  );
}
