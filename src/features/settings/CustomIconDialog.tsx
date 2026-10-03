import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { Dialog } from "../../components/Dialog";
import type { Runtime } from "../../app/runtime";
import type { BookmarkNode } from "../../domain/tree";
import { prepareImage, sanitizeSvg } from "../../storage/images";
import { saveCustomIcon } from "../../storage/media";
import { RangeControl } from "./SettingsPanel";
export function CustomIconDialog({
  runtime,
  node,
  onClose,
}: {
  runtime: Runtime;
  node: BookmarkNode;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [source, setSource] = useState<HTMLImageElement>();
  const [zoom, setZoom] = useState(100);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const close = useCallback(() => {
    if (!saving.current) onClose();
  }, [onClose]);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setSource(undefined);
    setError("");
    if (file)
      void (async () => {
        if (file.size > 5 * 1024 * 1024) throw new Error("图标不能超过 5 MB。");
        if (
          !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
            file.type,
          )
        )
          throw new Error("请选择 PNG、JPEG、WebP 或 SVG 图片。");
        const blob =
          file.type === "image/svg+xml"
            ? new Blob([sanitizeSvg(await file.text())], {
                type: "image/svg+xml",
              })
            : file;
        if (!active) return;
        url = URL.createObjectURL(blob);
        const image = new Image();
        image.src = url;
        await image.decode();
        if (
          !image.naturalWidth ||
          image.naturalWidth * image.naturalHeight > 80_000_000
        )
          throw new Error("图片尺寸无效或过大。");
        if (active) {
          setSource(image);
          setZoom(100);
          setX(50);
          setY(50);
        }
      })().catch((reason) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  const size = source
    ? (Math.min(source.naturalWidth, source.naturalHeight) * 100) / zoom
    : 0;
  const cropX = source ? ((source.naturalWidth - size) * x) / 100 : 0;
  const cropY = source ? ((source.naturalHeight - size) * y) / 100 : 0;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !source) return;
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(source, cropX, cropY, size, size, 0, 0, 256, 256);
  }, [source, size, cropX, cropY]);
  async function save() {
    if (!file || !source || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (!runtime.bookmarks.tree.nodes.has(node.id))
        throw new Error("书签已被删除，请关闭窗口。");
      const blob = await prepareImage(file, "icon", {
        x: cropX,
        y: cropY,
        size,
      });
      await saveCustomIcon(runtime.settings, node.id, blob);
      onClose();
    } catch (reason) {
      setError(String(reason));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog title={`自定义图标 · ${node.title}`} onClose={close}>
      <div className="icon-editor">
        <p>裁剪一块喜欢的图案。保存为 128 × 128 WebP，保留透明区域。</p>
        <div className="crop-preview">
          {source ? (
            <canvas
              ref={canvas}
              width="256"
              height="256"
              aria-label="图标裁剪预览"
            />
          ) : (
            <ImagePlus size={40} />
          )}
        </div>
        <label className="button upload-label">
          <Upload size={16} />
          选择图标
          <input
            type="file"
            disabled={busy}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            aria-label="上传自定义图标"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </label>
        <small>PNG、JPEG、WebP、SVG · 最大 5 MB</small>
        {source && (
          <div className="crop-controls">
            <RangeControl
              label="缩放"
              value={zoom}
              min={100}
              max={400}
              unit="%"
              onChange={setZoom}
            />
            <RangeControl
              label="水平位置"
              value={x}
              min={0}
              max={100}
              unit="%"
              onChange={setX}
            />
            <RangeControl
              label="垂直位置"
              value={y}
              min={0}
              max={100}
              unit="%"
              onChange={setY}
            />
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button className="button" disabled={busy} onClick={close}>
            取消
          </button>
          <button
            className="button primary"
            disabled={!source || busy}
            onClick={() => void save()}
          >
            {busy ? "保存中…" : "保存图标"}
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
