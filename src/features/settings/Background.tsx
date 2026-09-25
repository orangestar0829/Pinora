import { useEffect, useState, type CSSProperties } from "react";
import { defaults, type Settings } from "../../storage/settings";
import { assetStore } from "../../storage/assets";
export function Background({ settings }: { settings: Settings }) {
  const bg = settings.background;
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setUrl(undefined);
    setError("");
    if (bg.type === "image" && bg.assetId)
      void assetStore
        .get(bg.assetId)
        .then((blob) => {
          if (!active) return;
          if (!blob) {
            setError("本地壁纸已丢失，请在背景设置中重新导入。");
            return;
          }
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch((reason) => {
          if (active) setError(String(reason));
        });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bg.type, bg.assetId]);
  const style: CSSProperties = {
    backgroundColor:
      bg.color === defaults.background.color && bg.type === "solid"
        ? "var(--default-canvas)"
        : bg.color,
    backgroundImage:
      bg.type === "gradient"
        ? `linear-gradient(135deg, ${bg.color}, ${bg.gradientEnd})`
        : url
          ? `url("${url}")`
          : undefined,
    backgroundSize:
      bg.fit === "stretch"
        ? "100% 100%"
        : bg.fit === "center" || bg.fit === "tile"
          ? "auto"
          : bg.fit,
    backgroundPosition: "center",
    backgroundRepeat: bg.fit === "tile" ? "repeat" : "no-repeat",
    filter:
      bg.type === "image"
        ? `blur(${bg.blur}px) brightness(${bg.brightness}%)`
        : undefined,
    transform: bg.blur && bg.type === "image" ? "scale(1.08)" : undefined,
  };
  return (
    <>
      <div className="wallpaper-layer" style={style} aria-hidden="true" />
      <div
        className="wallpaper-overlay"
        style={{ opacity: bg.type === "image" ? bg.overlay / 100 : 0 }}
        aria-hidden="true"
      />
      {error && (
        <div className="asset-error" role="status">
          {error}
        </div>
      )}
    </>
  );
}
