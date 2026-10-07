import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type CSSProperties,
} from "react";
import type { Runtime } from "../../app/runtime";
import type { RecentVisit } from "../../types/browser";
import { hostname, safeHref } from "../../domain/url";

type Status = "loading" | "permission" | "denied" | "ready" | "error";

export function RecentVisits({
  runtime,
  rows = 2,
}: {
  runtime: Runtime;
  rows?: number;
}) {
  const { adapter } = runtime;
  const [entries, setEntries] = useState<RecentVisit[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [openError, setOpenError] = useState("");
  const [readError, setReadError] = useState("");
  const alive = useRef(false);
  const revision = useRef(0);
  const denied = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    const active = () => alive.current && revision.current === current;
    setEntries([]);
    setStatus("loading");
    setReadError("");
    try {
      const granted = await adapter.hasHistoryPermission();
      if (!active()) return;
      if (!granted) {
        setStatus(denied.current ? "denied" : "permission");
        return;
      }
      const visits = await adapter.getRecentVisits();
      if (!active()) return;
      // Recheck after the read so a revoked grant never publishes old results.
      const stillGranted = await adapter.hasHistoryPermission();
      if (!active()) return;
      if (!stillGranted) {
        setStatus("permission");
        return;
      }
      denied.current = false;
      setEntries(visits);
      setStatus("ready");
    } catch (reason) {
      if (active()) {
        setEntries([]);
        setReadError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
      }
    }
  }, [adapter]);

  useEffect(() => {
    alive.current = true;
    if (adapter.preview)
      return () => {
        alive.current = false;
      };
    const reload = () => {
      void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const unsubscribe = adapter.onHistoryChanged(reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", visible);
    reload();
    return () => {
      alive.current = false;
      revision.current++;
      unsubscribe();
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [adapter, refresh]);

  async function open(visit: RecentVisit, event: MouseEvent) {
    event.preventDefault();
    setOpenError("");
    try {
      await adapter.open(
        visit.url,
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
    <section className="recent-visits" aria-labelledby="recent-visits-title">
      <header className="recent-visits-heading">
        <h2 id="recent-visits-title">最近访问</h2>
      </header>
      {adapter.preview ? (
        <div className="recent-visits-state">
          <p>安装扩展后，可授权显示浏览器的最近访问记录。</p>
        </div>
      ) : status === "loading" ? (
        <div className="recent-visits-state" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <p>正在读取最近访问…</p>
        </div>
      ) : status === "permission" || status === "denied" ? (
        <div className="recent-visits-state">
          <p>
            {status === "denied"
              ? "尚未获得浏览历史权限。你可以再次启用，并在浏览器提示中允许访问。"
              : "允许读取浏览历史后，在这里显示最近访问的网页。"}
          </p>
          <p className="recent-visits-hint">请在设置中授予历史记录权限。</p>
        </div>
      ) : status === "error" ? (
        <div className="recent-visits-state" role="alert">
          <p>
            暂时无法读取最近访问，请重试。
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
          className={`bookmark-grid history-grid labels-${runtime.settings.value.layout.labels}`}
          style={
            {
              "--history-rows": Math.max(1, Math.min(4, rows)),
            } as CSSProperties
          }
        >
          {entries.slice(0, Math.max(1, Math.min(4, rows)) * 7).map((visit) => (
            <div className="bookmark-tile" key={visit.id}>
              <a
                className="tile-main"
                href={safeHref(visit.url)}
                title={`${visit.title || hostname(visit.url)}\n${visit.url}`}
                aria-label={visit.title || hostname(visit.url)}
                draggable={false}
                onClick={(event) => void open(visit, event)}
                onAuxClick={(event) => {
                  if (event.button === 1) void open(visit, event);
                }}
              >
                <VisitIcon url={visit.url} runtime={runtime} />
                <span className="tile-title">
                  {visit.title || hostname(visit.url)}
                </span>
                {runtime.settings.value.layout.showHostname && (
                  <span className="tile-meta">{hostname(visit.url)}</span>
                )}
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="recent-visits-state" role="status">
          <p>暂无最近访问记录，浏览网页后会显示在这里。</p>
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

function VisitIcon({ url, runtime }: { url: string; runtime: Runtime }) {
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
