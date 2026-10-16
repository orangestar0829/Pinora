import { useEffect, useRef, useState } from "react";
import type { Runtime } from "../../app/runtime";

export type PermissionKind = "history" | "topSites";
export type PermissionState =
  "checking" | "granted" | "denied" | "pending" | "error";
export function permissionCopy(state: PermissionState) {
  if (state === "checking") return "检查权限中…";
  if (state === "pending") return "等待授权…";
  if (state === "granted") return "已授权";
  if (state === "error") return "检查失败";
  return "未授权";
}
// Tracks optional permissions and exposes a click handler that issues the
// native request synchronously, as Chromium/Edge require a user gesture.
export function usePermissions(
  runtime: Runtime,
  onError: (message: string) => void,
) {
  const [history, setHistory] = useState<PermissionState>("checking");
  const [topSites, setTopSites] = useState<PermissionState>("checking");
  const requestPermission = useRef<((kind: PermissionKind) => void) | null>(
    null,
  );
  const reportError = useRef(onError);
  reportError.current = onError;
  useEffect(() => {
    let active = true;
    const queries = {
      history: { sequence: 0, pending: false },
      topSites: { sequence: 0, pending: false },
    };
    const setters = { history: setHistory, topSites: setTopSites };
    const refresh = async (kind: PermissionKind) => {
      const query = queries[kind];
      if (!active || query.pending) return;
      const sequence = ++query.sequence;
      try {
        const granted =
          kind === "history"
            ? await runtime.adapter.hasHistoryPermission()
            : await runtime.adapter.hasTopSitesPermission();
        if (active && query.sequence === sequence && !query.pending)
          setters[kind](granted ? "granted" : "denied");
      } catch {
        if (active && query.sequence === sequence && !query.pending)
          setters[kind]("error");
      }
    };
    requestPermission.current = (kind) => {
      const query = queries[kind];
      if (!active || query.pending) return;
      query.pending = true;
      query.sequence += 1;
      setters[kind]("pending");
      reportError.current("");
      const failed = (reason: unknown) => {
        if (!active) return;
        query.pending = false;
        setters[kind]("error");
        reportError.current(String(reason));
      };
      try {
        // Keep the native request on the synchronous user-gesture stack.
        const request =
          kind === "history"
            ? runtime.adapter.requestHistoryPermission()
            : runtime.adapter.requestTopSitesPermission();
        void request.then(() => {
          if (!active) return;
          query.pending = false;
          // Events during the prompt are folded into this authoritative check.
          void refresh(kind);
        }, failed);
      } catch (reason) {
        failed(reason);
      }
    };
    const refreshHistory = () => void refresh("history");
    const refreshTopSites = () => void refresh("topSites");
    const refreshAll = () => {
      refreshHistory();
      refreshTopSites();
    };
    const unsubscribeHistory = runtime.adapter.onHistoryChanged(refreshHistory);
    const unsubscribeTopSites =
      runtime.adapter.onTopSitesChanged(refreshTopSites);
    window.addEventListener("focus", refreshAll);
    refreshAll();
    return () => {
      active = false;
      requestPermission.current = null;
      unsubscribeHistory();
      unsubscribeTopSites();
      window.removeEventListener("focus", refreshAll);
    };
  }, [runtime]);
  return {
    history,
    topSites,
    request: (kind: PermissionKind) => requestPermission.current?.(kind),
  };
}
