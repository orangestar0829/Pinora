import { useEffect, useRef, useState } from "react";
import type { Runtime } from "../../app/runtime";
import { prepareImage } from "../../storage/images";
import { saveWallpaper } from "../../storage/media";

// Lives in the panel rather than the background tab so switching tabs keeps
// an in-flight upload, while closing the panel or changing background cancels it.
export function useWallpaperUpload(
  runtime: Runtime,
  onError: (message: string) => void,
) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  useEffect(
    () => () => {
      uploadSequence.current += 1;
    },
    [],
  );
  const cancel = () => {
    uploadSequence.current += 1;
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  async function upload(file?: File) {
    if (!file) return;
    const sequence = ++uploadSequence.current;
    const { type, assetId } = runtime.settings.value.background;
    const isCurrent = () => uploadSequence.current === sequence;
    setBusy(true);
    onError("");
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
      onError(String(reason));
    } finally {
      if (isCurrent()) {
        setBusy(false);
        if (input.current) input.current.value = "";
      }
    }
  }
  return { busy, input, upload, cancel };
}
