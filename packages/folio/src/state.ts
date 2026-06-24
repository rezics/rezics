import type { FolioAction, FolioState } from "./types";

export const DEFAULT_STATE: FolioState = {
  readMode: "page",
  chapterIndex: 0,
  pageIndex: 0,
  pageCount: 0,
  scrollOffset: 0,
  fontSize: 16,
  lineHeight: 1.6,
  theme: "light",
  turnStyle: "rotate",
  status: { state: "idle" },
};

export function folioReducer(
  state: FolioState,
  action: FolioAction,
): FolioState {
  switch (action.type) {
    case "SET_READ_MODE":
      return {
        ...state,
        readMode: action.mode,
        pageIndex: 0,
        pageCount: 0,
        scrollOffset: 0,
      };
    case "SET_CHAPTER":
      return {
        ...state,
        chapterIndex: action.index,
        pageIndex: 0,
        scrollOffset: 0,
        pageCount: 0,
      };
    case "SET_PAGE":
      return { ...state, pageIndex: action.index };
    case "SET_FONT_SIZE":
      return { ...state, fontSize: action.size };
    case "SET_LINE_HEIGHT":
      return { ...state, lineHeight: action.height };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_TURN_STYLE":
      return { ...state, turnStyle: action.style };
    case "SET_PAGE_COUNT":
      return { ...state, pageCount: action.count };
    case "SET_SCROLL_OFFSET":
      return { ...state, scrollOffset: action.offset };
    case "SET_STATUS":
      return { ...state, status: action.status };
    default:
      return state;
  }
}
