// Comment contracts
export type CommentDTO = {
  id: string;
  rootPostId: string;
  parentCommentId?: string | null;
  depth: number;
  content?: string | null;
  created_at?: string;
  user?: { id: string; name: string; avatar?: string };
};

export type CreateCommentInput = {
  rootPostId: string;
  parentCommentId?: string | null;
  content: string;
};

export type UpdateCommentInput = {
  content: string;
};
