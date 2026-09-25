import { createAdapter } from '../browser';
import { SettingsService } from '../storage/settings';
import { BookmarkService } from './bookmarks';
export function createRuntime() {
  const adapter = createAdapter(); const bookmarks = new BookmarkService(adapter); const settings = new SettingsService(adapter);
  let unsubscribe: (() => void) | undefined;
  return { adapter, bookmarks, settings,
    async start() {
      await settings.start(); await bookmarks.start();
      const prune = () => { if (!bookmarks.error) void settings.pruneIcons(new Set(bookmarks.tree.nodes.keys())).catch(error => { settings.error = `清理已删除书签的图标映射失败：${String(error)}`; }); };
      unsubscribe = bookmarks.subscribe(prune); prune();
    },
    stop() { unsubscribe?.(); bookmarks.stop(); settings.stop(); },
  };
}
