export interface RawBookmark {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  children?: RawBookmark[];
  unmodifiable?: string;
  folderType?: string;
}
export type OpenMode = "current" | "new" | "background";
export interface RecentVisit {
  id: string;
  title: string;
  url: string;
  lastVisitTime: number;
}
export interface PopularSite {
  title: string;
  url: string;
}
export interface BrowserAdapter {
  readonly preview: boolean;
  hasHistoryPermission(): Promise<boolean>;
  requestHistoryPermission(): Promise<boolean>;
  getRecentVisits(): Promise<RecentVisit[]>;
  onHistoryChanged(listener: () => void): () => void;
  hasTopSitesPermission(): Promise<boolean>;
  requestTopSitesPermission(): Promise<boolean>;
  getTopSites(): Promise<PopularSite[]>;
  onTopSitesChanged(listener: () => void): () => void;
  getTree(): Promise<RawBookmark[]>;
  create(input: {
    parentId: string;
    title: string;
    url?: string;
  }): Promise<RawBookmark>;
  update(
    id: string,
    input: { title?: string; url?: string },
  ): Promise<RawBookmark>;
  remove(id: string, recursive: boolean): Promise<void>;
  move(id: string, parentId: string, index?: number): Promise<RawBookmark>;
  onBookmarksChanged(listener: () => void): () => void;
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  onStorageChanged(key: string, listener: (value: unknown) => void): () => void;
  favicon(url: string, size?: number): string | undefined;
  open(url: string, mode: OpenMode): Promise<void>;
}
