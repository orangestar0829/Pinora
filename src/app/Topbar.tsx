import type { RefObject } from "react";
import { ArrowLeft, Search, Settings, X } from "lucide-react";

export function Topbar({
  parentId,
  navigate,
  query,
  setQuery,
  searchRef,
  onOpenSettings,
}: {
  parentId: string | undefined;
  navigate: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  onOpenSettings: () => void;
}) {
  return (
    <header className="topbar">
      <div className="recent-visits-heading bookmarks-heading">
        <h2 id="bookmarks-title">书签</h2>
        {parentId && (
          <button
            className="button parent-folder"
            onClick={() => navigate(parentId)}
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
          onClick={onOpenSettings}
        >
          <Settings size={21} />
        </button>
      </div>
    </header>
  );
}
