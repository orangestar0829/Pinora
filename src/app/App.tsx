import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { getRuntime, useRuntime, type Runtime } from "./runtime";
import type { BookmarkNode } from "../domain/tree";
import type { Settings } from "../storage/settings";
import {
  BookmarkDialog,
  type BookmarkAction,
} from "../features/bookmarks/BookmarkDialogs";
import { RecentVisits } from "../features/history/RecentVisits";
import { TopSites } from "../features/history/TopSites";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { Background } from "../features/settings/Background";
import { CustomIconDialog } from "../features/settings/CustomIconDialog";
import { useFolderNavigation } from "./useFolderNavigation";
import { useDashboardShortcuts, useThemeAttribute } from "./useDocumentEffects";
import { Topbar } from "./Topbar";
import { Notices, RecoveryDialog } from "./Notices";
import { BookmarkSection } from "./BookmarkSection";

export function App() {
  const [runtime] = useState(() => {
    try {
      return getRuntime();
    } catch {
      return null;
    }
  });
  return runtime ? (
    <Dashboard runtime={runtime} />
  ) : (
    <main className="fatal">
      <img src="/logo.svg" width="64" alt="" />
      <h1>欢迎使用 Pinora</h1>
      <p>请在已安装扩展的新标签页中打开，或使用预览模式体验示例书签。</p>
      <a className="button primary" href="?preview=1">
        打开示例预览
      </a>
    </main>
  );
}
function layoutVariables({ layout, background }: Settings) {
  return {
    "--tile-size": `${layout.tileSize}px`,
    "--icon-size": `${layout.iconSize}px`,
    "--gap-x": `${layout.gapX}px`,
    "--gap-y": `${layout.gapY}px`,
    "--tile-radius": `${layout.radius}px`,
    "--tile-font": `${layout.fontSize}px`,
    "--content-width": `${layout.maxWidth}px`,
    "--user-background":
      background.type === "gradient"
        ? `linear-gradient(135deg, ${background.color}, ${background.gradientEnd})`
        : background.color,
  } as CSSProperties;
}
function Dashboard({ runtime }: { runtime: Runtime }) {
  const { tree, settings } = useRuntime(runtime);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<BookmarkAction>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [iconNode, setIconNode] = useState<BookmarkNode>();
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeAction = useCallback(() => setAction(undefined), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeIcon = useCallback(() => setIconNode(undefined), []);
  const nav = useFolderNavigation(tree, settings.bookmarkFolderId);
  const { rootId, currentId, current, navigate, searching } = nav;
  useEffect(() => {
    const listener = (event: Event) => {
      const node = runtime.bookmarks.tree.nodes.get(
        (event as CustomEvent<string>).detail,
      );
      if (node) setIconNode(node);
    };
    window.addEventListener("pinora:custom-icon", listener);
    return () => window.removeEventListener("pinora:custom-icon", listener);
  }, [runtime]);
  const start = useCallback(async () => {
    setError("");
    try {
      await runtime.start();
      setReady(true);
    } catch (reason) {
      setError(String(reason));
    }
  }, [runtime]);
  useEffect(() => {
    void start();
    return () => runtime.stop();
  }, [runtime, start]);
  useEffect(() => {
    setAction(undefined);
    setIconNode(undefined);
  }, [rootId, settings.bookmarkFolderId]);
  useDashboardShortcuts({
    searchRef,
    overlayOpen: !!action || settingsOpen || !!iconNode,
    query: nav.query,
    setQuery: nav.setQuery,
    parentId: nav.parentId,
    navigate,
  });
  useThemeAttribute(settings.theme);
  async function open(node: BookmarkNode, event?: MouseEvent) {
    if (node.folder) navigate(node.id);
    else if (node.url) {
      try {
        await runtime.adapter.open(
          node.url,
          event?.ctrlKey || event?.metaKey || event?.button === 1
            ? "background"
            : event?.shiftKey
              ? "new"
              : settings.openMode,
        );
      } catch (reason) {
        setError(String(reason));
      }
    }
  }
  function retry() {
    setError("");
    void (
      ready
        ? Promise.all([
            runtime.settings.refresh(),
            runtime.bookmarks.refresh(),
            runtime.retryMaintenance(),
          ])
        : start()
    ).catch((reason) => setError(String(reason)));
  }
  async function recover() {
    setError("");
    try {
      await runtime.settings.resetToDefaults();
      if (!ready) await start();
      setRecoveryOpen(false);
    } catch (reason) {
      setError(String(reason));
    }
  }
  return (
    <div className="shell" style={layoutVariables(settings)}>
      <Background settings={settings} />
      <div className="workspace">
        <Topbar
          parentId={nav.parentId}
          navigate={navigate}
          query={nav.query}
          setQuery={nav.setQuery}
          searchRef={searchRef}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="main-content">
          <Notices
            runtime={runtime}
            error={error}
            onRetry={retry}
            onRecover={() => setRecoveryOpen(true)}
          />
          <h1 className="sr-only">
            {searching ? "书签搜索结果" : current?.title || "我的书签"}
          </h1>
          <BookmarkSection
            runtime={runtime}
            ready={ready}
            nav={nav}
            onOpen={open}
            onAction={setAction}
            onError={setError}
            onChooseFolder={() => setSettingsOpen(true)}
          />
          {ready && current && currentId === rootId && !searching && (
            <>
              {settings.showRecentVisits && (
                <RecentVisits
                  runtime={runtime}
                  rows={settings.recentVisitsRows}
                />
              )}
              {settings.showTopSites && (
                <TopSites runtime={runtime} rows={settings.topSitesRows} />
              )}
            </>
          )}
        </main>
      </div>
      {recoveryOpen && (
        <RecoveryDialog
          error={error}
          onClose={() => setRecoveryOpen(false)}
          onConfirm={recover}
        />
      )}
      {action && (
        <BookmarkDialog
          key={JSON.stringify(action)}
          action={action}
          runtime={runtime}
          onClose={closeAction}
        />
      )}{" "}
      {settingsOpen && (
        <SettingsPanel runtime={runtime} onClose={closeSettings} />
      )}
      {iconNode && (
        <CustomIconDialog
          runtime={runtime}
          node={iconNode}
          onClose={closeIcon}
        />
      )}
    </div>
  );
}
