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
export interface BrowserAdapter {
  readonly preview: boolean;
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
