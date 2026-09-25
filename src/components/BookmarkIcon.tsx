import { useEffect, useState } from "react";
import { Folder } from "lucide-react";
import type { BookmarkNode } from "../domain/tree";
import type { Runtime } from "../app/runtime";
import { assetStore } from "../storage/assets";
export function BookmarkIcon({
  node,
  runtime,
}: {
  node: BookmarkNode;
  runtime: Runtime;
}) {
  const asset = runtime.settings.value.iconMappings[node.id];
  const [custom, setCustom] = useState<string>();
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    let alive = true;
    let url: string | undefined;
    setCustom(undefined);
    if (asset)
      void assetStore
        .get(asset)
        .then((blob) => {
          if (alive && blob) {
            url = URL.createObjectURL(blob);
            setCustom(url);
          }
        })
        .catch(() => undefined);
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset]);
  const source =
    custom ?? (node.url ? runtime.adapter.favicon(node.url, 64) : undefined);
  return (
    <span className={`bookmark-icon ${node.folder ? "folder-icon" : ""}`}>
      {source && failed !== source ? (
        <img src={source} alt="" onError={() => setFailed(source)} />
      ) : node.folder ? (
        <Folder strokeWidth={1.55} />
      ) : (
        <span>
          {(node.hostname.replace(/^www\./, "") || node.title)
            .slice(0, 1)
            .toUpperCase()}
        </span>
      )}
    </span>
  );
}
