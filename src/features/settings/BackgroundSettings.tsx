import { ImagePlus, RotateCcw, Upload } from "lucide-react";
import { defaults, type Settings } from "../../storage/settings";
import { Field, RangeControl, type SettingsTabProps } from "./controls";
import type { useWallpaperUpload } from "./useWallpaperUpload";

export function BackgroundSettings({
  settings,
  update,
  wallpaper,
}: SettingsTabProps & { wallpaper: ReturnType<typeof useWallpaperUpload> }) {
  const background = settings.background;
  return (
    <section className="settings-section">
      <h3>为收藏选一块画布</h3>
      <Field label="背景类型">
        <select
          value={background.type}
          onChange={(event) => {
            const value = event.target.value;
            wallpaper.cancel();
            update((draft) => {
              draft.background.type = value as Settings["background"]["type"];
            });
          }}
        >
          <option value="solid">纯色</option>
          <option value="gradient">渐变</option>
          <option value="image">本地图片</option>
        </select>
      </Field>
      {background.type !== "image" ? (
        <div className="color-controls">
          <Field
            label={background.type === "gradient" ? "起始颜色" : "背景颜色"}
          >
            <input
              type="color"
              value={background.color}
              onChange={(event) => {
                const value = event.target.value;
                update((draft) => {
                  draft.background.color = value;
                });
              }}
            />
          </Field>
          {background.type === "gradient" && (
            <Field label="结束颜色">
              <input
                type="color"
                value={background.gradientEnd}
                onChange={(event) => {
                  const value = event.target.value;
                  update((draft) => {
                    draft.background.gradientEnd = value;
                  });
                }}
              />
            </Field>
          )}
        </div>
      ) : (
        <>
          <div className="image-upload">
            <ImagePlus size={28} />
            <strong>
              {background.assetId ? "已保存本地壁纸" : "把喜欢的风景带进来"}
            </strong>
            <p>PNG、JPEG、WebP 或 SVG · 最大 30 MB</p>
            <button
              className="button"
              disabled={wallpaper.busy}
              onClick={() => wallpaper.input.current?.click()}
            >
              <Upload size={15} />
              {wallpaper.busy ? "正在处理…" : "选择本地图片"}
            </button>
            <input
              ref={wallpaper.input}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              aria-label="上传壁纸"
              onChange={(event) =>
                void wallpaper.upload(event.target.files?.[0])
              }
            />
          </div>
          <Field label="图片适配">
            <select
              value={background.fit}
              onChange={(event) => {
                const value = event.target.value;
                update((draft) => {
                  draft.background.fit = value as Settings["background"]["fit"];
                });
              }}
            >
              <option value="cover">覆盖</option>
              <option value="contain">完整显示</option>
              <option value="center">居中</option>
              <option value="stretch">拉伸</option>
              <option value="tile">平铺</option>
            </select>
          </Field>
          <RangeControl
            label="背景模糊"
            value={background.blur}
            min={0}
            max={40}
            onChange={(value) =>
              update((draft) => {
                draft.background.blur = value;
              })
            }
          />
          <RangeControl
            label="亮度"
            value={background.brightness}
            min={20}
            max={150}
            unit="%"
            onChange={(value) =>
              update((draft) => {
                draft.background.brightness = value;
              })
            }
          />
          <RangeControl
            label="遮罩浓度"
            value={background.overlay}
            min={0}
            max={90}
            unit="%"
            onChange={(value) =>
              update((draft) => {
                draft.background.overlay = value;
              })
            }
          />
        </>
      )}
      <button
        className="button reset-settings"
        onClick={() => {
          wallpaper.cancel();
          update((draft) => {
            draft.background = structuredClone(defaults.background);
          });
        }}
      >
        <RotateCcw size={14} />
        恢复默认背景
      </button>
    </section>
  );
}
