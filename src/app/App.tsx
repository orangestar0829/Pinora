import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { ArrowLeft, Search, Settings, Plus, Folder, X } from "lucide-react";
import { getRuntime, useRuntime, type Runtime } from "./runtime";
import { searchTree, type BookmarkNode } from "../domain/tree";
import {
  resolveBookmarkFolder,
  isInBookmarkFolder,
} from "../domain/folderScope";
import {
  BookmarkDialog,
  type BookmarkAction,
} from "../features/bookmarks/BookmarkDialogs";
import { BookmarkGrid } from "../features/bookmarks/BookmarkGrid";
import { RecentVisits } from "../features/history/RecentVisits";
import { TopSites } from "../features/history/TopSites";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { Background } from "../features/settings/Background";
import { CustomIconDialog } from "../features/settings/CustomIconDialog";
import { Dialog } from "../components/Dialog";

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
function Dashboard({ runtime }: { runtime: Runtime }) {
  const { tree, settings } = useRuntime(runtime);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [folderId, setFolderId] = useState<string>();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<BookmarkAction>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [iconNode, setIconNode] = useState<BookmarkNode>();
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeAction = useCallback(() => setAction(undefined), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeIcon = useCallback(() => setIconNode(undefined), []);
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
  useEffect(() => {
    setPage(0);
  }, [folderId, query]);
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
  const rootId = resolveBookmarkFolder(tree, settings.bookmarkFolderId);
  const currentId =
    folderId &&
    tree.nodes.get(folderId)?.folder &&
    isInBookmarkFolder(tree, folderId, rootId)
      ? folderId
      : rootId;
  const current = tree.nodes.get(currentId ?? "");
  useEffect(() => {
    setFolderId(rootId ?? undefined);
    setQuery("");
    setPage(0);
    setAction(undefined);
    setIconNode(undefined);
  }, [rootId, settings.bookmarkFolderId]);
  useEffect(() => {
    if (folderId && folderId !== currentId) {
      setFolderId(currentId ?? undefined);
      setQuery("");
      setPage(0);
    }
  }, [folderId, currentId]);
  const searching = !!query.trim();
  const results = searching
    ? searchTree(tree, query).filter(
        (node) =>
          node.id !== rootId && isInBookmarkFolder(tree, node.id, rootId),
      )
    : (current?.children.map((id) => tree.nodes.get(id)!) ?? []);
  const navigate = useCallback(
    (id: string) => {
      if (!tree.nodes.get(id)?.folder || !isInBookmarkFolder(tree, id, rootId))
        return;
      setFolderId(id);
      setQuery("");
    },
    [tree, rootId],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && !action && !settingsOpen && !iconNode) {
        if (query) setQuery("");
        else if (current?.parentId && current.id !== rootId)
          navigate(current.parentId);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [action, settingsOpen, iconNode, query, current, navigate, rootId]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);
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
  const layout = settings.layout;
  const variables = {
    "--tile-size": `${layout.tileSize}px`,
    "--icon-size": `${layout.iconSize}px`,
    "--gap-x": `${layout.gapX}px`,
    "--gap-y": `${layout.gapY}px`,
    "--tile-radius": `${layout.radius}px`,
    "--tile-font": `${layout.fontSize}px`,
    "--content-width": `${layout.maxWidth}px`,
    "--user-background":
      settings.background.type === "gradient"
        ? `linear-gradient(135deg, ${settings.background.color}, ${settings.background.gradientEnd})`
        : settings.background.color,
  } as CSSProperties;
  const writable =
    current && !current.readOnly && current.parentId !== undefined;
  return (
    <div className="shell" style={variables}>
      <Background settings={settings} />
      <div className="workspace">
        <header className="topbar">
          <div className="recent-visits-heading bookmarks-heading">
            <h2 id="bookmarks-title">书签</h2>
            {current?.parentId && current.id !== rootId && (
              <button
                className="button parent-folder"
                onClick={() => navigate(current.parentId!)}
                aria-label="返回上级"
                title="返回上级"
              >
                <ArrowLeft size={15} />
                <span>返回上级</span>
              </button>
            )}
          </div>
          <div className="topbar-right">
            <label className="search">
              <Search size={17} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索书签与文件夹"
                aria-label="搜索书签与文件夹"
              />
              {query ? (
                <button
                  className="icon-button"
                  onClick={() => setQuery("")}
                  aria-label="清除搜索"
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd>Ctrl F</kbd>
              )}
            </label>
            <button
              className="icon-button settings-trigger"
              title="外观与设置"
              aria-label="外观与设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={21} />
            </button>
          </div>
        </header>
        <main className="main-content">
          {runtime.adapter.preview && (
            <div className="preview-banner">
              <span className="status-dot" />
              示例预览 · 以下为合成书签，不会修改你的浏览器书签
            </div>
          )}
          {(error ||
            runtime.bookmarks.error ||
            runtime.settings.error ||
            runtime.settings.maintenanceError) && (
            <div className="error-banner" role="alert">
              <span>
                {error ||
                  runtime.bookmarks.error ||
                  runtime.settings.error ||
                  runtime.settings.maintenanceError}
              </span>
              <button
                onClick={() => {
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
                }}
              >
                重试读取
              </button>
              {runtime.settings.needsRecovery && (
                <button onClick={() => setRecoveryOpen(true)}>
                  恢复默认设置…
                </button>
              )}
            </div>
          )}
          <h1 className="sr-only">
            {searching ? "书签搜索结果" : current?.title || "我的书签"}
          </h1>
          <section
            className="bookmarks-section"
            aria-labelledby="bookmarks-title"
          >
            {!ready ? (
              <div className="empty-state">
                <span className="loading-ring" />
                <h2>正在整理你的书签…</h2>
                <p>从浏览器读取，保持原来的样子。</p>
              </div>
            ) : !current ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <Folder size={32} />
                </span>
                <h2>书签文件夹不可用</h2>
                <p>所选文件夹可能已被删除，请在设置中重新选择书签文件夹。</p>
                <button
                  className="button primary"
                  onClick={() => setSettingsOpen(true)}
                >
                  选择书签文件夹
                </button>
              </div>
            ) : results.length ? (
              <BookmarkGrid
                key={`${rootId}:${currentId}`}
                nodes={results.slice(
                  Math.min(
                    page,
                    Math.max(0, Math.ceil(results.length / 200) - 1),
                  ) * 200,
                  (Math.min(
                    page,
                    Math.max(0, Math.ceil(results.length / 200) - 1),
                  ) +
                    1) *
                    200,
                )}
                runtime={runtime}
                editing={false}
                searching={searching}
                onOpen={open}
                onAction={setAction}
                onError={setError}
              />
            ) : (
              <div className="empty-state">
                <span className="empty-icon">
                  {searching ? <Search size={32} /> : <Folder size={32} />}
                </span>
                <h2>{searching ? "暂时没有找到" : "为下一次灵感留个位置"}</h2>
                <p>
                  {searching
                    ? "试试更短的关键词，或搜索网址与文件夹名称。"
                    : "添加一个书签，或在浏览器书签管理器中整理这个文件夹。"}
                </p>
                {!searching && writable && (
                  <button
                    className="button primary"
                    onClick={() =>
                      setAction({
                        kind: "create-bookmark",
                        parentId: current.id,
                      })
                    }
                  >
                    <Plus size={17} />
                    添加第一个书签
                  </button>
                )}
              </div>
            )}
          </section>
          {results.length > 200 && (
            <nav className="pagination" aria-label="书签分页">
              <button
                className="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                上一页
              </button>
              <span>
                第 {Math.min(page + 1, Math.ceil(results.length / 200))} /{" "}
                {Math.ceil(results.length / 200)} 页
              </span>
              <button
                className="button"
                disabled={(page + 1) * 200 >= results.length}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </nav>
          )}
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
        <Dialog
          title="恢复默认设置"
          onClose={() => {
            if (!recovering) setRecoveryOpen(false);
          }}
        >
          <p>
            将先备份当前设置，再恢复默认书签文件夹、主题、布局、背景和图标设置。浏览器原生书签不会改变。
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button
              className="button"
              disabled={recovering}
              onClick={() => setRecoveryOpen(false)}
            >
              取消
            </button>
            <button
              className="button primary"
              disabled={recovering}
              onClick={async () => {
                setRecovering(true);
                setError("");
                try {
                  await runtime.settings.resetToDefaults();
                  if (!ready) await start();
                  setRecoveryOpen(false);
                } catch (reason) {
                  setError(String(reason));
                } finally {
                  setRecovering(false);
                }
              }}
            >
              {recovering ? "正在备份并恢复…" : "备份并恢复默认"}
            </button>
          </footer>
        </Dialog>
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
