import { useFolio } from "../context";

export function useModeSwitch() {
  const { state, dispatch } = useFolio();

  return (mode: "scroll" | "page") => {
    if (mode === state.readMode) return;

    if (mode === "page" && state.readMode === "scroll") {
      // Estimate page from scroll progress — actual page count may not be known yet
      // This sets a best-guess that PageContainer will refine after mount
      // 根据滚动进度估算页码——实际页数此时可能尚不可知
      // 这里设置一个最佳猜测值，PageContainer 会在挂载后进一步修正
      dispatch({ type: "SET_READ_MODE", mode: "page" });
    } else {
      dispatch({ type: "SET_READ_MODE", mode: "scroll" });
    }
  };
}
