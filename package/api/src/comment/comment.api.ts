import type {
  CommentListBody,
  CommentListQuery,
  CommentListResponse,
  CommentResponse,
  CreateCommentInput,
  UpdateCommentInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const commentApi = {
  get: async (id: string): Promise<CommentResponse> => {
    return apiFetch<CommentResponse>(`/comment/${id}`);
  },

  list: async (query: CommentListQuery): Promise<CommentListResponse> => {
    const qs = buildQueryString(query);
    return apiFetch<CommentListResponse>(`/comment/list${qs}`);
  },

  listByBody: async (body: CommentListBody): Promise<CommentListResponse> => {
    return apiFetch<CommentListResponse>("/comment/list", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  create: async (input: CreateCommentInput): Promise<CommentResponse> => {
    return apiFetch<CommentResponse>("/comment/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    id: string,
    input: UpdateCommentInput,
  ): Promise<CommentResponse> => {
    return apiFetch<CommentResponse>(`/comment/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/comment/${id}`, {
      method: "DELETE",
    });
  },
};
