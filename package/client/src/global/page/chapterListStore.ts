import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface ChapterListStoreData {
    expandedNodes: string;
}

/**
 * ChapterListStore 状态结构
 * - 支持多本书，key 为 bookId (string)
 */
interface ChapterListState {
    /** 所有书籍元信息，按 bookId 存储 */
    chapterList: Record<string, ChapterListStoreData>;

    /**
     * setChapterList
     * @param bookId - 书籍唯一 ID
     * @param data - 章节列表数据
     */
    setChapterList: (bookId: string, data: ChapterListStoreData) => void;

    /**
     * updateChapterList
     * @param bookId - 书籍唯一 ID
     * @param data - 章节列表数据
     */
    updateChapterList: (bookId: string, data: ChapterListStoreData) => void;
}

/**
 * ChapterListStore
 * - 用于存储和管理章节列表数据
 * - 支持多本书的章节列表数据
 * @example
 * const chapterList = useChapterListStore((s) => s.chapterList[bookId]);
 * useChapterListStore.getState().updateChapterList(bookId, {expandedNodes: new Set()});
 */
export const useChapterListStore = create<ChapterListState>()(
    devtools((set) => ({
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
    })),
);
