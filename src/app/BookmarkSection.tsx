import type { MouseEvent } from "react";
import { Search, Plus, Folder } from "lucide-react";
import type { BookmarkNode } from "../domain/tree";
import type { BookmarkAction } from "../features/bookmarks/BookmarkDialogs";
import { BookmarkGrid } from "../features/bookmarks/BookmarkGrid";
import type { Runtime } from "./runtime";
import { PAGE_SIZE, type useFolderNavigation } from "./useFolderNavigation";

export function BookmarkSection({
  runtime,
  ready,
  nav,
  onOpen,
  onAction,
  onError,
  onChooseFolder,
}: {
  runtime: Runtime;
  ready: boolean;
  nav: ReturnType<typeof useFolderNavigation>;
  onOpen: (node: BookmarkNode, event?: MouseEvent) => void;
  onAction: (action: BookmarkAction) => void;
  onError: (message: string) => void;
  onChooseFolder: () => void;
}) {
  const { current, searching, results, page, setPage, pageCount } = nav;
  const writable =
    current && !current.readOnly && current.parentId !== undefined;
  return (
    <>
      <section className="bookmarks-section" aria-labelledby="bookmarks-title">
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
            <button className="button primary" onClick={onChooseFolder}>
              选择书签文件夹
            </button>
          </div>
        ) : results.length ? (
          <BookmarkGrid
            key={`${nav.rootId}:${nav.currentId}`}
            nodes={nav.pageNodes}
            runtime={runtime}
            editing={false}
            searching={searching}
            onOpen={onOpen}
            onAction={onAction}
            onError={onError}
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
                  onAction({ kind: "create-bookmark", parentId: current.id })
                }
              >
                <Plus size={17} />
                添加第一个书签
              </button>
            )}
          </div>
        )}
      </section>
      {results.length > PAGE_SIZE && (
        <nav className="pagination" aria-label="书签分页">
          <button
            className="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            上一页
          </button>
          <span>
            第 {Math.min(page + 1, pageCount)} / {pageCount} 页
          </span>
          <button
            className="button"
            disabled={(page + 1) * PAGE_SIZE >= results.length}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </nav>
      )}
    </>
  );
}
