import { useLayoutEffect, useState } from "react";
import type { Settings } from "../../storage/settings";

export function useGridColumns({
  tileSize,
  gapX,
  maxWidth,
}: Pick<Settings["layout"], "tileSize" | "gapX" | "maxWidth">) {
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(1);

  useLayoutEffect(() => {
    if (!grid) {
      setColumns(1);
      return;
    }
    let active = true;
    const measure = () => {
      if (!active) return;
      // This grid uses auto-fill; computed styles resolve it to pixel tracks.
      const tracks = getComputedStyle(grid).gridTemplateColumns;
      setColumns(
        tracks && tracks !== "none" ? tracks.trim().split(/\s+/).length : 1,
      );
    };
    // Measure before paint, including after a loading state mounts a new grid.
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => {
      active = false;
      observer.disconnect();
    };
    // Tile size and gap can change the column count without resizing the grid.
  }, [grid, tileSize, gapX, maxWidth]);

  return { gridRef: setGrid, columns };
}
