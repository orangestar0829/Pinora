import { RotateCcw } from "lucide-react";
import { defaults, type Settings } from "../../storage/settings";
import { Field, RangeControl, type SettingsTabProps } from "./controls";
import {
  permissionCopy,
  type PermissionKind,
  type PermissionState,
} from "./usePermissions";

const contentSections = [
  {
    kind: "history",
    label: "历史记录",
    hint: "显示最近访问的网页，仅在本机读取。",
    show: "showRecentVisits",
    rows: "recentVisitsRows",
  },
  {
    kind: "topSites",
    label: "热门网站",
    hint: "按浏览器访问频率显示常用网站。",
    show: "showTopSites",
    rows: "topSitesRows",
  },
] as const;
const layoutRanges = [
  ["tileSize", "卡片尺寸", 96, 240],
  ["iconSize", "图标尺寸", 20, 96],
  ["gapX", "水平间距", 4, 64],
  ["gapY", "垂直间距", 4, 64],
  ["radius", "卡片圆角", 0, 40],
  ["fontSize", "标题字号", 10, 24],
  ["maxWidth", "内容最大宽度", 640, 2400],
] as const;
export function LayoutSettings({
  settings,
  update,
  permissions,
  onRequestPermission,
}: SettingsTabProps & {
  permissions: Record<PermissionKind, PermissionState>;
  onRequestPermission: (kind: PermissionKind) => void;
}) {
  return (
    <section className="settings-section">
      <h3>主页内容</h3>
      <p>选择是否展示浏览器中的历史记录和热门网站，并设置每项占用的行数。</p>
      {contentSections.map(({ kind, label, hint, show, rows }) => {
        const permission = permissions[kind];
        return (
          <div className="content-setting" key={kind}>
            <div className="content-setting-main">
              <label className="toggle-control">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={settings[show]}
                  onChange={(event) => {
                    const value = event.target.checked;
                    update((draft) => {
                      draft[show] = value;
                    });
                  }}
                />
              </label>
              <p className="setting-hint">{hint}</p>
            </div>
            <div className="content-setting-actions">
              <span className="permission-status" role="status">
                {permissionCopy(permission)}
              </span>
              {permission !== "granted" && (
                <button
                  className="button"
                  type="button"
                  disabled={
                    permission === "pending" || permission === "checking"
                  }
                  onClick={() => onRequestPermission(kind)}
                >
                  {permission === "pending" ? "授权中…" : "获取权限"}
                </button>
              )}
            </div>
            <Field label="展示行数">
              <select
                aria-label={`${label}展示行数`}
                value={settings[rows]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  update((draft) => {
                    draft[rows] = value;
                  });
                }}
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count} 行
                  </option>
                ))}
              </select>
            </Field>
          </div>
        );
      })}
      <h3>给每个收藏，留一点空间</h3>
      <div className="range-columns">
        {layoutRanges.map(([key, label, min, max]) => (
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
  );
}
