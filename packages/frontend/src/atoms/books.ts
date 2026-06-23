import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const bookQuery = (unitId: string) =>
  ApiClient.query("books", "getBook", {
    params: { unitId },
    query: {},
    reactivityKeys: [Keys.unit(unitId)],
  });

export const bookRatingQuery = (unitId: string) =>
  ApiClient.query("books", "getBookRating", {
    params: { unitId },
    reactivityKeys: [Keys.unit(unitId)],
  });

export const bookListQuery = (args: { offset?: number; limit?: number }) =>
  ApiClient.query("books", "listBooks", {
    query: args,
    reactivityKeys: [Keys.units],
  });

export const bookContentStructureQuery = (unitId: string) =>
  ApiClient.query("books", "getBookContentStructure", {
    params: { unitId },
    reactivityKeys: [Keys.unit(unitId)],
  });

export const createBookAtom = ApiClient.mutation("books", "createBook");
export const updateBookAtom = ApiClient.mutation("books", "updateBook");
