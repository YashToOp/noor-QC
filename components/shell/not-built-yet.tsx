"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The routes outside this build's scope (build prompt Part F) render a real
 * §5.10 empty state rather than a 404 — the sidebar IA is part of the pitch,
 * so every row has to lead somewhere that looks like the rest of the product.
 */
export function NotBuiltYet({
  title,
  icon,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
}) {
  const router = useRouter();
  return (
    <>
      <PageHeader title={title} />
      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <Card title={title}>
          <EmptyState
            icon={icon}
            title="Not part of this build"
            description={description}
            action={{ label: "Go to the gate queue", onClick: () => router.push("/gates") }}
          />
        </Card>
      </div>
    </>
  );
}
