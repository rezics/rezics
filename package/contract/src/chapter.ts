// Chapter contracts
export type ChapterListDTO = {
  order: number[] | number[][];
  chapters: { id: number; title: string; noContent: boolean }[];
};

export type ChapterDetailDTO = {
  id: number;
  title: string;
  content?: string;
};

export type CreateChapterInput = {
  bookId: string;
  title: string;
  content?: string;
  parentId?: number | null;
};

export type UpdateChapterInput = Partial<Omit<CreateChapterInput, 'bookId'>>;
