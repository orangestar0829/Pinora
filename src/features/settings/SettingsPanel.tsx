import { useState } from "react";
import {
  SlidersHorizontal,
  Palette,
  ImagePlus,
  ShieldCheck,
} from "lucide-react";
import { Dialog } from "../../components/Dialog";
import { useRuntime, type Runtime } from "../../app/runtime";
import type { UpdateSettings } from "./controls";
import { usePermissions } from "./usePermissions";
import { useWallpaperUpload } from "./useWallpaperUpload";
import { AppearanceSettings } from "./AppearanceSettings";
import { LayoutSettings } from "./LayoutSettings";
import { BackgroundSettings } from "./BackgroundSettings";
import { AboutSettings } from "./AboutSettings";

const tabs = [
  { id: "appearance", label: "外观", icon: Palette },
  { id: "layout", label: "布局", icon: SlidersHorizontal },
  { id: "background", label: "背景", icon: ImagePlus },
  { id: "privacy", label: "关于", icon: ShieldCheck },
] as const;
export function SettingsPanel({
  runtime,
  onClose,
}: {
  runtime: Runtime;
  onClose: () => void;
}) {
  const { settings, tree } = useRuntime(runtime);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("appearance");
  const [error, setError] = useState("");
  const permissions = usePermissions(runtime, setError);
  const wallpaper = useWallpaperUpload(runtime, setError);
  const update: UpdateSettings = (mutate) => {
    setError("");
    void runtime.settings
      .update(mutate)
      .catch((reason) => setError(String(reason)));
  };
  return (
    <Dialog
      title="让这里，更像你"
      onClose={() => {
        wallpaper.cancel();
        onClose();
      }}
    >
      <div className="settings-panel">
        <p className="settings-intro">小小调整，找到舒服的浏览节奏。</p>
        <nav className="settings-tabs" aria-label="设置分类">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        {tab === "appearance" && (
          <AppearanceSettings settings={settings} update={update} tree={tree} />
        )}
        {tab === "layout" && (
          <LayoutSettings
            settings={settings}
            update={update}
            permissions={permissions}
            onRequestPermission={permissions.request}
          />
        )}
        {tab === "background" && (
          <BackgroundSettings
            settings={settings}
            update={update}
            wallpaper={wallpaper}
          />
        )}
        {tab === "privacy" && <AboutSettings />}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-saved">
          <ShieldCheck size={14} />
          <span>修改自动保存在本机，并同步到已打开的新标签页</span>
        </div>
      </div>
    </Dialog>
  );
}
