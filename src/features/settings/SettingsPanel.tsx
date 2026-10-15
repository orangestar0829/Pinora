import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Sun,
  Moon,
  Monitor,
  SlidersHorizontal,
  Palette,
  ImagePlus,
  ShieldCheck,
  RotateCcw,
  Upload,
  Check,
} from "lucide-react";
import { Dialog } from "../../components/Dialog";
import { useRuntime, type Runtime } from "../../app/runtime";
import { defaults, type Settings } from "../../storage/settings";
import { prepareImage } from "../../storage/images";
import { saveWallpaper } from "../../storage/media";
import { version } from "../../../package.json";

export function RangeControl({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <output>
          {value} {unit}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="setting-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function SettingsPanel({
  runtime,
  onClose,
}: {
  runtime: Runtime;
  onClose: () => void;
}) {
  const { settings, tree } = useRuntime(runtime);
  const folders = [...tree.nodes.values()].filter(
    (node) => node.folder && node.parentId !== undefined,
  );
  const folderPath = (id: string) => {
    const node = tree.nodes.get(id);
    return node
      ? [...node.path, node.id]
          .filter((part) => !tree.roots.includes(part))
          .map((part) => tree.nodes.get(part)?.title)
          .join(" / ")
      : "所选文件夹已不可用";
  };
  const [tab, setTab] = useState("appearance");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyPermission, setHistoryPermission] = useState<
    "checking" | "granted" | "denied" | "pending" | "error"
  >("checking");
  const [topSitesPermission, setTopSitesPermission] = useState<
    "checking" | "granted" | "denied" | "pending" | "error"
  >("checking");
  const requestPermission = useRef<
    ((kind: "history" | "topSites") => void) | null
  >(null);
  const input = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  useEffect(
    () => () => {
      uploadSequence.current += 1;
    },
    [],
  );
  const cancelUpload = () => {
    uploadSequence.current += 1;
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  const update = (mutate: (draft: Settings) => void) => {
    setError("");
    void runtime.settings
      .update(mutate)
      .catch((reason) => setError(String(reason)));
  };
  useEffect(() => {
    let active = true;
    const queries = {
      history: { sequence: 0, pending: false },
      topSites: { sequence: 0, pending: false },
    };
    const refresh = async (kind: "history" | "topSites") => {
      const query = queries[kind];
      if (!active || query.pending) return;
      const sequence = ++query.sequence;
      const setPermission =
        kind === "history" ? setHistoryPermission : setTopSitesPermission;
      try {
        const granted =
          kind === "history"
            ? await runtime.adapter.hasHistoryPermission()
            : await runtime.adapter.hasTopSitesPermission();
        if (active && query.sequence === sequence && !query.pending)
          setPermission(granted ? "granted" : "denied");
      } catch {
        if (active && query.sequence === sequence && !query.pending)
          setPermission("error");
      }
    };
    requestPermission.current = (kind) => {
      const query = queries[kind];
      if (!active || query.pending) return;
      query.pending = true;
      query.sequence += 1;
      const setPermission =
        kind === "history" ? setHistoryPermission : setTopSitesPermission;
      setPermission("pending");
      setError("");
      const failed = (reason: unknown) => {
        if (!active) return;
        query.pending = false;
        setPermission("error");
        setError(String(reason));
      };
      try {
        // Keep the native request on the synchronous user-gesture stack.
        const request =
          kind === "history"
            ? runtime.adapter.requestHistoryPermission()
            : runtime.adapter.requestTopSitesPermission();
        void request.then(() => {
          if (!active) return;
          query.pending = false;
          // Events during the prompt are folded into this authoritative check.
          void refresh(kind);
        }, failed);
      } catch (reason) {
        failed(reason);
      }
    };
    const refreshHistory = () => void refresh("history");
    const refreshTopSites = () => void refresh("topSites");
    const refreshAll = () => {
      refreshHistory();
      refreshTopSites();
    };
    const unsubscribeHistory = runtime.adapter.onHistoryChanged(refreshHistory);
    const unsubscribeTopSites =
      runtime.adapter.onTopSitesChanged(refreshTopSites);
    window.addEventListener("focus", refreshAll);
    refreshAll();
    return () => {
      active = false;
      requestPermission.current = null;
      unsubscribeHistory();
      unsubscribeTopSites();
      window.removeEventListener("focus", refreshAll);
    };
  }, [runtime]);
  const permissionCopy = (state: typeof historyPermission) => {
    if (state === "checking") return "检查权限中…";
    if (state === "pending") return "等待授权…";
    if (state === "granted") return "已授权";
    if (state === "error") return "检查失败";
    return "未授权";
  };
  async function upload(file?: File) {
    if (!file) return;
    const sequence = ++uploadSequence.current;
    const { type, assetId } = runtime.settings.value.background;
    const isCurrent = () => uploadSequence.current === sequence;
    setBusy(true);
    setError("");
    try {
      await saveWallpaper(
        runtime.settings,
        await prepareImage(file, "wallpaper"),
        (draft) =>
          isCurrent() &&
          draft.background.type === type &&
          draft.background.assetId === assetId,
      );
    } catch (reason) {
      setError(String(reason));
    } finally {
      if (isCurrent()) {
        setBusy(false);
        if (input.current) input.current.value = "";
      }
    }
  }
  const tabs = [
    { id: "appearance", label: "外观", icon: Palette },
    { id: "layout", label: "布局", icon: SlidersHorizontal },
    { id: "background", label: "背景", icon: ImagePlus },
    { id: "privacy", label: "关于", icon: ShieldCheck },
  ];
  return (
    <Dialog
      title="让这里，更像你"
      onClose={() => {
        cancelUpload();
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
          <section className="settings-section">
            <h3>你的书签，从这里开始</h3>
            <label className="setting-field bookmark-folder-field">
              <span>书签文件夹</span>
              <select
                aria-label="书签文件夹"
                aria-describedby="bookmark-folder-hint"
                value={settings.bookmarkFolderId ?? ""}
                onChange={(event) => {
                  const value = event.target.value || null;
                  update((draft) => {
                    draft.bookmarkFolderId = value;
                  });
                }}
              >
                <option value="">默认文件夹</option>
                {settings.bookmarkFolderId &&
                  !folders.some(
                    (node) => node.id === settings.bookmarkFolderId,
                  ) && (
                    <option value={settings.bookmarkFolderId} disabled>
                      所选文件夹已不可用，请重新选择
                    </option>
                  )}
                {folders.map((node) => (
                  <option key={node.id} value={node.id}>
                    {folderPath(node.id)}
                  </option>
                ))}
              </select>
            </label>
            <p
              id="bookmark-folder-hint"
              className="setting-hint folder-selection-hint"
            >
              {settings.bookmarkFolderId
                ? `当前选择：${folderPath(settings.bookmarkFolderId)}。`
                : "默认使用浏览器的首个可用书签文件夹。"}
              主页和搜索仅展示此文件夹及其子文件夹中的内容。
            </p>
            <h3>光线与心情</h3>
            <p>选择喜欢的主题，也可以跟随系统切换。</p>
            <div className="theme-options">
              {(
                [
                  { value: "light", label: "浅色", icon: Sun },
                  { value: "dark", label: "深色", icon: Moon },
                  { value: "system", label: "跟随系统", icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  className={`theme-option ${value}`}
                  aria-pressed={settings.theme === value}
                  key={value}
                  onClick={() =>
                    update((draft) => {
                      draft.theme = value;
                    })
                  }
                >
                  <span className="theme-preview">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    <Icon size={15} />
                    {label}
                    {settings.theme === value && <Check size={15} />}
                  </span>
                </button>
              ))}
            </div>
            <Field label="点击书签时">
              <select
                value={settings.openMode}
                onChange={(event) => {
                  const value = event.target.value;
                  update((draft) => {
                    draft.openMode = value as Settings["openMode"];
                  });
                }}
              >
                <option value="current">在当前标签页打开</option>
                <option value="new">在新标签页打开</option>
                <option value="background">在后台标签页打开</option>
              </select>
            </Field>
            <p className="setting-hint">中键或 Ctrl / ⌘ 点击始终在后台打开。</p>
          </section>
        )}
        {tab === "layout" && (
          <section className="settings-section">
            <h3>主页内容</h3>
            <p>
              选择是否展示浏览器中的历史记录和热门网站，并设置每项占用的行数。
            </p>
            <div className="content-setting">
              <div className="content-setting-main">
                <label className="toggle-control">
                  <span>历史记录</span>
                  <input
                    type="checkbox"
                    checked={settings.showRecentVisits}
                    onChange={(event) => {
                      const value = event.target.checked;
                      update((draft) => {
                        draft.showRecentVisits = value;
                      });
                    }}
                  />
                </label>
                <p className="setting-hint">
                  显示最近访问的网页，仅在本机读取。
                </p>
              </div>
              <div className="content-setting-actions">
                <span className="permission-status" role="status">
                  {permissionCopy(historyPermission)}
                </span>
                {historyPermission !== "granted" && (
                  <button
                    className="button"
                    type="button"
                    disabled={
                      historyPermission === "pending" ||
                      historyPermission === "checking"
                    }
                    onClick={() => requestPermission.current?.("history")}
                  >
                    {historyPermission === "pending" ? "授权中…" : "获取权限"}
                  </button>
                )}
              </div>
              <Field label="展示行数">
                <select
                  aria-label="历史记录展示行数"
                  value={settings.recentVisitsRows}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    update((draft) => {
                      draft.recentVisitsRows = value;
                    });
                  }}
                >
                  {[1, 2, 3, 4].map((rows) => (
                    <option key={rows} value={rows}>
                      {rows} 行
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="content-setting">
              <div className="content-setting-main">
                <label className="toggle-control">
                  <span>热门网站</span>
                  <input
                    type="checkbox"
                    checked={settings.showTopSites}
                    onChange={(event) => {
                      const value = event.target.checked;
                      update((draft) => {
                        draft.showTopSites = value;
                      });
                    }}
                  />
                </label>
                <p className="setting-hint">按浏览器访问频率显示常用网站。</p>
              </div>
              <div className="content-setting-actions">
                <span className="permission-status" role="status">
                  {permissionCopy(topSitesPermission)}
                </span>
                {topSitesPermission !== "granted" && (
                  <button
                    className="button"
                    type="button"
                    disabled={
                      topSitesPermission === "pending" ||
                      topSitesPermission === "checking"
                    }
                    onClick={() => requestPermission.current?.("topSites")}
                  >
                    {topSitesPermission === "pending" ? "授权中…" : "获取权限"}
                  </button>
                )}
              </div>
              <Field label="展示行数">
                <select
                  aria-label="热门网站展示行数"
                  value={settings.topSitesRows}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    update((draft) => {
                      draft.topSitesRows = value;
                    });
                  }}
                >
                  {[1, 2, 3, 4].map((rows) => (
                    <option key={rows} value={rows}>
                      {rows} 行
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <h3>给每个收藏，留一点空间</h3>
            <div className="range-columns">
              {(
                [
                  ["tileSize", "卡片尺寸", 96, 240],
                  ["iconSize", "图标尺寸", 20, 96],
                  ["gapX", "水平间距", 4, 64],
                  ["gapY", "垂直间距", 4, 64],
                  ["radius", "卡片圆角", 0, 40],
                  ["fontSize", "标题字号", 10, 24],
                  ["maxWidth", "内容最大宽度", 640, 2400],
                ] as const
              ).map(([key, label, min, max]) => (
                <RangeControl
                  key={key}
                  label={label}
                  value={settings.layout[key]}
                  min={min}
                  max={max}
                  onChange={(value) =>
                    update((draft) => {
                      draft.layout[key] = value;
                    })
                  }
                />
              ))}
            </div>
            <Field label="标题显示">
              <select
                value={settings.layout.labels}
                onChange={(event) => {
                  const value = event.target.value;
                  update((draft) => {
                    draft.layout.labels = value as Settings["layout"]["labels"];
                  });
                }}
              >
                <option value="one">一行</option>
                <option value="two">两行</option>
                <option value="hidden">隐藏标题</option>
              </select>
            </Field>
            <label className="toggle-control">
              <span>显示网站域名和文件夹项目数</span>
              <input
                type="checkbox"
                checked={settings.layout.showHostname}
                onChange={(event) => {
                  const value = event.target.checked;
                  update((draft) => {
                    draft.layout.showHostname = value;
                  });
                }}
              />
            </label>
            <button
              className="button reset-settings"
              onClick={() =>
                update((draft) => {
                  draft.layout = structuredClone(defaults.layout);
                })
              }
            >
              <RotateCcw size={14} />
              恢复默认布局
            </button>
          </section>
        )}
        {tab === "background" && (
          <section className="settings-section">
            <h3>为收藏选一块画布</h3>
            <Field label="背景类型">
              <select
                value={settings.background.type}
                onChange={(event) => {
                  const value = event.target.value;
                  cancelUpload();
                  update((draft) => {
                    draft.background.type =
                      value as Settings["background"]["type"];
                  });
                }}
              >
                <option value="solid">纯色</option>
                <option value="gradient">渐变</option>
                <option value="image">本地图片</option>
              </select>
            </Field>
            {settings.background.type !== "image" ? (
              <div className="color-controls">
                <Field
                  label={
                    settings.background.type === "gradient"
                      ? "起始颜色"
                      : "背景颜色"
                  }
                >
                  <input
                    type="color"
                    value={settings.background.color}
                    onChange={(event) => {
                      const value = event.target.value;
                      update((draft) => {
                        draft.background.color = value;
                      });
                    }}
                  />
                </Field>
                {settings.background.type === "gradient" && (
                  <Field label="结束颜色">
                    <input
                      type="color"
                      value={settings.background.gradientEnd}
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
                    {settings.background.assetId
                      ? "已保存本地壁纸"
                      : "把喜欢的风景带进来"}
                  </strong>
                  <p>PNG、JPEG、WebP 或 SVG · 最大 30 MB</p>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => input.current?.click()}
                  >
                    <Upload size={15} />
                    {busy ? "正在处理…" : "选择本地图片"}
                  </button>
                  <input
                    ref={input}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    aria-label="上传壁纸"
                    onChange={(event) => void upload(event.target.files?.[0])}
                  />
                </div>
                <Field label="图片适配">
                  <select
                    value={settings.background.fit}
                    onChange={(event) => {
                      const value = event.target.value;
                      update((draft) => {
                        draft.background.fit =
                          value as Settings["background"]["fit"];
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
                  value={settings.background.blur}
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
                  value={settings.background.brightness}
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
                  value={settings.background.overlay}
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
                cancelUpload();
                update((draft) => {
                  draft.background = structuredClone(defaults.background);
                });
              }}
            >
              <RotateCcw size={14} />
              恢复默认背景
            </button>
          </section>
        )}
        {tab === "privacy" && (
          <section className="settings-section about-panel">
            <img src="/logo.svg" width="52" height="52" alt="" />
            <h3>
              Pinora <span>{version}</span>
            </h3>
            <p>
              本地优先的新标签页，以浏览器原生书签为中心，也可展示最近访问的网页和热门网站。
            </p>
            <div className="privacy-note">
              <ShieldCheck size={23} />
              <div>
                <strong>数据留在本机</strong>
                <p>
                  无账户、无广告、无分析统计。设置、图标和壁纸保存在本机；历史记录和热门网站列表仅从本机浏览器读取，不另行保存，也不上报。
                </p>
              </div>
            </div>
            <p>
              基础功能使用书签、存储和本地网站图标权限。书签直接由浏览器管理，浏览器自身的书签同步仍由浏览器负责。
            </p>
            <p>
              历史记录和热门网站均为可选功能。在「布局 →
              主页内容」中，可分别获取权限、控制是否展示，并设置展示行数。
            </p>
          </section>
        )}
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
