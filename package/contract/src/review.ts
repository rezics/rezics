// Review contracts
export type ReviewDTO = {
  id: string;
  bookId: string;
  content: string;
  rating?: number;
  created_at?: string;
  user?: { id: string; name: string; avatar?: string };
};

export type QuoteDTO = {
  id: string;
  text: string;
  from?: string;
};

export type CreateReviewInput = {
  bookId: string;
  content: string;
  rating?: number;
};

export type UpdateReviewInput = Partial<CreateReviewInput>;
