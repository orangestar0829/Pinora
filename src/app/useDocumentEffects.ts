import { useEffect, type RefObject } from "react";
import type { Settings } from "../storage/settings";

export function useThemeAttribute(theme: Settings["theme"]) {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
// Ctrl/Cmd+F focuses search; Escape clears the query, then walks up a folder.
export function useDashboardShortcuts({
  searchRef,
  overlayOpen,
  query,
  setQuery,
  parentId,
  navigate,
}: {
  searchRef: RefObject<HTMLInputElement | null>;
  overlayOpen: boolean;
  query: string;
  setQuery: (query: string) => void;
  parentId: string | undefined;
  navigate: (id: string) => void;
}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && !overlayOpen) {
        if (query) setQuery("");
        else if (parentId) navigate(parentId);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [searchRef, overlayOpen, query, setQuery, parentId, navigate]);
}
