"use client";

import { ViewModeProvider, useViewMode } from "./view-mode-context";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils/cn";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { viewMode } = useViewMode();
  const isMobile = viewMode === "mobile";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className={cn(
            "p-6 pt-[50px] md:pt-6 min-h-full",
            isMobile &&
              "max-w-[430px] mx-auto border-x border-[var(--border)] border-dashed"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function LayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ViewModeProvider>
      <LayoutInner>{children}</LayoutInner>
    </ViewModeProvider>
  );
}
