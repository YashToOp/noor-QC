"use client";

import { Sidebar } from "@/components/shell/sidebar";
import { useRealtimeInvalidation } from "@/lib/realtime";

/**
 * App shell — DESIGN_SYSTEM.md §4.1.
 *
 * A #f5f5fa canvas, a 260px sidebar sitting directly on it with no border, and
 * a white content panel inset by 4px (`m-1`) with a 16px radius and a 0.5px
 * #d5d5e8 border. The panel is the only scroll container — the sidebar does
 * not live inside it.
 *
 * The realtime subscription is mounted here, once, so every page shares one
 * socket and the sidebar badge updates no matter which screen is open.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useRealtimeInvalidation();

  return (
    <div className="flex h-screen min-w-[1440px] overflow-x-auto bg-canvas antialiased">
      <Sidebar />
      <main className="relative z-10 m-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-hairline border-line bg-surface p-4">
        {children}
      </main>
    </div>
  );
}
