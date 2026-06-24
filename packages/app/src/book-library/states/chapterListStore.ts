import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface ChapterListStoreData {
  expandedNodes: string;
}

/**
 * ChapterListStore state shape.
 * ChapterListStore 状态结构。
 * - Supports multiple books, keyed by bookId (string).
 * - 支持多本书，key 为 bookId (string)。
 */
interface ChapterListState {
  /** All book metadata, stored by bookId. 所有书籍元信息，按 bookId 存储。 */
  chapterList: Record<string, ChapterListStoreData>;

  /**
   * setChapterList
   * @param bookId - Unique book ID。书籍唯一 ID。
   * @param data - Chapter list data。章节列表数据。
   */
  setChapterList: (bookId: string, data: ChapterListStoreData) => void;

  /**
   * updateChapterList
   * @param bookId - Unique book ID。书籍唯一 ID。
   * @param data - Chapter list data。章节列表数据。
   */
  updateChapterList: (bookId: string, data: ChapterListStoreData) => void;
}

/**
 * ChapterListStore
 * - Stores and manages chapter list data.
 * - 用于存储和管理章节列表数据。
 * - Supports chapter list data for multiple books.
 * - 支持多本书的章节列表数据。
 * @example
 * const chapterList = useChapterListStore((s) => s.chapterList[bookId]);
 * useChapterListStore.getState().updateChapterList(bookId, {expandedNodes: new Set()});
 */
export const useChapterListStore = create<ChapterListState>()(
  devtools(
    (set) => ({
      chapterList: {},

      setChapterList: (bookId, data) =>
        set((state) => ({
          chapterList: {
            ...state.chapterList,
            [bookId]: data,
          },
        })),

      updateChapterList: (bookId, data) =>
        set((state) => {
          const prev = state.chapterList[bookId] ?? {};
          // console.log("updateChapterList", bookId, data, state);
          return {
            chapterList: {
              ...state.chapterList,
              [bookId]: { ...prev, ...data },
            },
          };
        }),
    }),
    { name: "chapterListStore", store: "chapterListStore" },
  ),
);
