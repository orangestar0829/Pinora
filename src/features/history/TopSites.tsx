import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import type { Runtime } from "../../app/runtime";
import type { PopularSite } from "../../types/browser";
import { hostname, safeHref } from "../../domain/url";
import { useGridColumns } from "./useGridColumns";

type Status = "loading" | "permission" | "ready" | "error";

export function TopSites({
  runtime,
  rows = 2,
}: {
  runtime: Runtime;
  rows?: number;
}) {
  const { adapter } = runtime;
  const [entries, setEntries] = useState<PopularSite[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [readError, setReadError] = useState("");
  const [openError, setOpenError] = useState("");
  const alive = useRef(false);
  const revision = useRef(0);
  const maxRows = Math.max(1, Math.min(4, rows));
  const { gridRef, columns } = useGridColumns(runtime.settings.value.layout);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    const active = () => alive.current && revision.current === current;
    setEntries([]);
    setStatus("loading");
    setReadError("");
    try {
      const granted = await adapter.hasTopSitesPermission();
      if (!active()) return;
      if (!granted) {
        setStatus("permission");
        return;
      }
      const sites = await adapter.getTopSites();
      if (!active()) return;
      setEntries(sites);
      setStatus("ready");
    } catch (reason) {
      if (!active()) return;
      setReadError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  }, [adapter]);

  useEffect(() => {
    alive.current = true;
    if (adapter.preview) {
      setStatus("ready");
      return () => {
        alive.current = false;
      };
    }
    const reload = () => void refresh();
    const unsubscribe = adapter.onTopSitesChanged(reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    reload();
    return () => {
      alive.current = false;
      revision.current++;
      unsubscribe();
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [adapter, refresh]);

  async function open(site: PopularSite, event: MouseEvent) {
    event.preventDefault();
    setOpenError("");
    try {
      await adapter.open(
        site.url,
        event.ctrlKey || event.metaKey || event.button === 1
          ? "background"
          : event.shiftKey
            ? "new"
            : runtime.settings.value.openMode,
      );
    } catch {
      if (alive.current) setOpenError("无法打开此网页，请重试。");
    }
  }

  return (
    <section className="top-sites" aria-labelledby="top-sites-title">
      <header className="recent-visits-heading">
        <h2 id="top-sites-title">热门网站</h2>
      </header>
      {adapter.preview ? (
        <div className="recent-visits-state">
          <p>安装扩展后，可显示浏览器的热门网站。</p>
        </div>
      ) : status === "loading" ? (
        <div className="recent-visits-state" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <p>正在读取热门网站…</p>
        </div>
      ) : status === "permission" ? (
        <div className="recent-visits-state">
          <p>请在设置中授予热门网站权限。</p>
        </div>
      ) : status === "error" ? (
        <div className="recent-visits-state" role="alert">
          <p>
            暂时无法读取热门网站，请重试。
            {readError && (
              <small className="recent-visits-error">{readError}</small>
            )}
          </p>
          <button className="button" onClick={() => void refresh()}>
            重试读取
          </button>
        </div>
      ) : entries.length ? (
        <div
          ref={gridRef}
          className={`bookmark-grid history-grid labels-${runtime.settings.value.layout.labels}`}
        >
          {entries.slice(0, maxRows * columns).map((site) => (
            <div className="bookmark-tile" key={site.url}>
              <a
                className="tile-main"
                href={safeHref(site.url)}
                title={`${site.title || hostname(site.url)}\n${site.url}`}
                aria-label={site.title || hostname(site.url)}
                draggable={false}
                onClick={(event) => void open(site, event)}
                onAuxClick={(event) => {
                  if (event.button === 1) void open(site, event);
                }}
              >
                <SiteIcon url={site.url} runtime={runtime} />
                <span className="tile-title">
                  {site.title || hostname(site.url)}
                </span>
                {runtime.settings.value.layout.showHostname && (
                  <span className="tile-meta">{hostname(site.url)}</span>
                )}
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="recent-visits-state" role="status">
          <p>暂无热门网站记录。</p>
        </div>
      )}
      {openError && (
        <p className="form-error" role="alert">
          {openError}
        </p>
      )}
    </section>
  );
}

function SiteIcon({ url, runtime }: { url: string; runtime: Runtime }) {
  const [failed, setFailed] = useState<string>();
  const source = runtime.adapter.favicon(url, 64);
  return (
    <span className="bookmark-icon">
      {source && source !== failed ? (
        <img
          src={source}
          alt=""
          draggable={false}
          onError={() => setFailed(source)}
        />
      ) : (
        <span>
          {(hostname(url).replace(/^www\./, "") || "?")
            .slice(0, 1)
            .toUpperCase()}
        </span>
      )}
    </span>
  );
}
