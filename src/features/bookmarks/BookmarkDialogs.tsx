import { useState } from "react";
import { Dialog } from "../../components/Dialog";
import { canMove, type BookmarkNode } from "../../domain/tree";
import type { Runtime } from "../../app/runtime";
export type BookmarkAction =
  | { kind: "create-bookmark" | "create-folder"; parentId: string }
  | { kind: "edit" | "delete" | "move"; node: BookmarkNode };
export function BookmarkDialog({
  action,
  runtime,
  onClose,
}: {
  action: BookmarkAction;
  runtime: Runtime;
  onClose: () => void;
}) {
  const node = "node" in action ? action.node : undefined;
  const [title, setTitle] = useState(node?.title ?? "");
  const [url, setUrl] = useState(node?.url ?? "");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const folder = action.kind === "create-folder" || node?.folder;
  const deleting = action.kind === "delete",
    moving = action.kind === "move";
  const heading = deleting
    ? `删除${folder ? "文件夹" : "书签"}`
    : moving
      ? "移动到文件夹"
      : action.kind === "edit"
        ? folder
          ? "重命名文件夹"
          : "编辑书签"
        : folder
          ? "新建文件夹"
          : "添加书签";
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (action.kind === "delete")
        await runtime.bookmarks.remove(action.node.id, true);
      else if (action.kind === "move")
        await runtime.bookmarks.move(action.node.id, destination);
      else if (action.kind === "edit")
        await runtime.bookmarks.update(
          action.node.id,
          title,
          folder ? undefined : url,
        );
      else if ("parentId" in action)
        await runtime.bookmarks.create(
          action.parentId,
          title,
          folder ? undefined : url,
        );
      onClose();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={heading} onClose={busy ? () => undefined : onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {deleting ? (
          <p>
            确定删除“{node?.title}”吗？
            {node?.children.length ? (
              <strong className="danger-copy">
                此文件夹中的全部 {node.children.length}{" "}
                个直接子项及其所有后代也会从浏览器书签中删除。
              </strong>
            ) : (
              "此更改会同步到浏览器原生书签。"
            )}
          </p>
        ) : moving ? (
          <label>
            目标文件夹
            <select
              value={destination}
              required
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">请选择文件夹</option>
              {[...runtime.bookmarks.tree.nodes.values()]
                .filter((n) => canMove(runtime.bookmarks.tree, node!.id, n.id))
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {[...n.path, n.id]
                      .map((id) => runtime.bookmarks.tree.nodes.get(id)?.title)
                      .join(" / ")}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              名称
              <input
                required
                maxLength={500}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={folder ? "为文件夹起个名字" : "网站名称"}
              />
            </label>
            {!folder && (
              <label>
                网址
                <input
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  inputMode="url"
                />
              </label>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            取消
          </button>
          <button
            className={`button ${deleting ? "danger" : "primary"}`}
            disabled={busy}
          >
            {busy
              ? "处理中…"
              : deleting
                ? "确认删除"
                : moving
                  ? "移动"
                  : "保存"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
