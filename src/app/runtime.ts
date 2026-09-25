import { useEffect, useReducer } from "react";
import { createRuntime } from "../domain/runtime";
export type Runtime = ReturnType<typeof createRuntime>;
let instance: Runtime | undefined;
export function getRuntime() {
  return (instance ??= createRuntime());
}
export function useRuntime(runtime: Runtime) {
  const [, render] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const a = runtime.bookmarks.subscribe(render),
      b = runtime.settings.subscribe(render);
    return () => {
      a();
      b();
    };
  }, [runtime]);
  return { tree: runtime.bookmarks.tree, settings: runtime.settings.value };
}
