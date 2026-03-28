"use client";

import { createContext, useContext, useState } from "react";

type ViewMode = "desktop" | "mobile";

interface ViewModeContextValue {
  viewMode: ViewMode;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue>({
  viewMode: "desktop",
  toggleViewMode: () => {},
});

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const toggleViewMode = () =>
    setViewMode((prev) => (prev === "desktop" ? "mobile" : "desktop"));
  return (
    <ViewModeContext.Provider value={{ viewMode, toggleViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
