import { Sun, Moon, Monitor, Check } from "lucide-react";
import type { BookmarkTree } from "../../domain/tree";
import type { Settings } from "../../storage/settings";
import { Field, type SettingsTabProps } from "./controls";

export function AppearanceSettings({
  settings,
  update,
  tree,
}: SettingsTabProps & { tree: BookmarkTree }) {
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
  return (
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
            !folders.some((node) => node.id === settings.bookmarkFolderId) && (
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
  );
}
