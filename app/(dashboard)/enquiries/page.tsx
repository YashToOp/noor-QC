"use client";

import { FileText } from "lucide-react";
import { NotBuiltYet } from "@/components/shell/not-built-yet";

export default function Page() {
  return (
    <NotBuiltYet
      title="Enquiries"
      icon={<FileText />}
      description="Enquiries are created by Majlis. A read-only board belongs here in a later pass."
    />
  );
}
