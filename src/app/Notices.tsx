import { useState } from "react";
import { Dialog } from "../components/Dialog";
import type { Runtime } from "./runtime";

export function Notices({
  runtime,
  error,
  onRetry,
  onRecover,
}: {
  runtime: Runtime;
  error: string;
  onRetry: () => void;
  onRecover: () => void;
}) {
  const message =
    error ||
    runtime.bookmarks.error ||
    runtime.settings.error ||
    runtime.settings.maintenanceError;
  return (
    <>
      {runtime.adapter.preview && (
        <div className="preview-banner">
          <span className="status-dot" />
          示例预览 · 以下为合成书签，不会修改你的浏览器书签
        </div>
      )}
      {message && (
        <div className="error-banner" role="alert">
          <span>{message}</span>
          <button onClick={onRetry}>重试读取</button>
          {runtime.settings.needsRecovery && (
            <button onClick={onRecover}>恢复默认设置…</button>
          )}
        </div>
      )}
    </>
  );
}
export function RecoveryDialog({
  error,
  onClose,
  onConfirm,
}: {
  error: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [recovering, setRecovering] = useState(false);
  return (
    <Dialog
      title="恢复默认设置"
      onClose={() => {
        if (!recovering) onClose();
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
        <button className="button" disabled={recovering} onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          disabled={recovering}
          onClick={async () => {
            setRecovering(true);
            try {
              await onConfirm();
            } finally {
              setRecovering(false);
            }
          }}
        >
          {recovering ? "正在备份并恢复…" : "备份并恢复默认"}
        </button>
      </footer>
    </Dialog>
  );
}
