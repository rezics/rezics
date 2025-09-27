import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * 书籍元信息
 */
export interface BookMeta {
  description?: string | null;
  title?: string | null;
  [key: string]: any;
}

/**
 * BookPageStore 状态结构
 * - 支持多本书，key 为 bookId (string)
 */
interface BookPageState {
  /** 所有书籍元信息，按 bookId 存储 */
  books: Record<string, BookMeta>;

  /**
   * 设置书籍元信息（覆盖式）
   * @param bookId - 书籍唯一 ID
   * @param meta - 书籍元信息
   */
  setBook: (bookId: string, meta: BookMeta) => void;

  /**
   * 更新书籍某一字段（部分更新）
   * @param bookId - 书籍唯一 ID
   * @param patch - 要更新的字段
   */
  updateBook: (bookId: string, patch: Partial<BookMeta>) => void;
}

/**
 * BookPageStore
 * - 用于存储和管理书籍元信息
 * - 支持多本书的增量更新
 * @example
 * const book = useBookPageStore((s) => s.books[bookId]);
 * useBookPageStore.getState().updateBook(bookId, {description: "这是新的简介！",})
 */
export const useBookPageStore = create<BookPageState>()(
  devtools((set) => ({
    books: {},

    setBook: (bookId, meta) =>
      set((state) => ({
        books: {
          ...state.books,
          [bookId]: meta,
        },
      })),

    updateBook: (bookId, patch) =>
      set((state) => {
        const prev = state.books[bookId] ?? {
          title: "",
          description: "",
        };
        return {
          books: {
            ...state.books,
            [bookId]: { ...prev, ...patch },
          },
        };
      }),
  })),
);
