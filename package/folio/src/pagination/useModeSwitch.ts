import { useFolio } from "../context";

export function useModeSwitch() {
  const { state, dispatch } = useFolio();

  return (mode: "scroll" | "page") => {
    if (mode === state.readMode) return;

    if (mode === "page" && state.readMode === "scroll") {
      // Estimate page from scroll progress — actual page count may not be known yet
      // This sets a best-guess that PageContainer will refine after mount
      dispatch({ type: "SET_READ_MODE", mode: "page" });
    } else {
      dispatch({ type: "SET_READ_MODE", mode: "scroll" });
    }
  };
}
