import type {
  BookListResponse,
  BookResponse,
  CreateBookInput,
  ScoreAggregateDTO,
} from "@rezics/contract";
import {
  bookListQuerySchema,
  bookParamsSchema,
  createBookSchema,
  hasPermissionToUpdateBook,
  updateBookSchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { mapScoreAggregateToDTO } from "@/score/score.mapper";
import { scoreService } from "@/score/score.service";
import { unitService } from "@/unit/unit.service";
import { bookService } from "./book.service";
import { mapBookToDTO } from "./mapper";

export const bookApi = new Elysia({ prefix: "/books" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<BookResponse> => {
      const book = await bookService.getByUnitId(params.unitId);
      return mapBookToDTO(book);
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: "Get book",
        description: "Get a single book by unit ID",
        tags: ["Books"],
      },
    },
  )
  .get(
    "/:unitId/rating",
    async ({ params }): Promise<ScoreAggregateDTO[]> => {
      const aggregates = await scoreService.getAggregatesByUnit(params.unitId);
      return aggregates.map(mapScoreAggregateToDTO);
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: "Get score aggregates",
        description: "Get all realm score aggregates for a book by unit ID",
        tags: ["Books"],
      },
    },
  )
  .get(
    "/:unitId/chapterIndex",
    async ({ params }): Promise<any> => {
      return bookService.getChapterIndexByBookUnitId(params.unitId);
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: "Get chapterIndex",
        description: "Get chapterIndex by bookUnitId",
        tags: ["Books"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<BookResponse> => {
      const bookReq: CreateBookInput = {
        userId: identity.unitId,
        ...body,
      };

      const book = await bookService.create(bookReq);
      return mapBookToDTO(book);
    },
    {
      requireLogin: true,
      body: createBookSchema,
      detail: {
        summary: "Create book",
        description:
          "Create a new book with Unit, Book extension, and optional translations",
        tags: ["Books"],
      },
    },
  )
  .get(
    "/",
    async ({ identity, query }): Promise<BookListResponse> => {
      if (identity.role !== "ADMIN" && identity.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { books, total } = await bookService.list(query);
      return { books: books.map(mapBookToDTO), total };
    },
    {
      requireLogin: true,
      query: bookListQuerySchema,
      detail: {
        summary: "Get all books",
        description:
          "Get all books with filters (isbn13, personId, organizationId, tags, language) and pagination",
        tags: ["Books"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<BookResponse> => {
      const targetBookUnit = await unitService.getByUnitId(params.unitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.unitId}`);
      }

      if (
        !hasPermissionToUpdateBook(identity, undefined, targetBookUnit as any)
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this book",
        );
      }

      const book = await bookService.update(params.unitId, body);
      return mapBookToDTO(book);
    },
    {
      requireLogin: true,
      params: bookParamsSchema,
      body: updateBookSchema,
      detail: {
        summary: "Update book",
        description: "Update an existing book by unit ID",
        tags: ["Books"],
      },
    },
  )
  .put(
    "/:unitId/chapterIndex",
    async ({ params, body, identity, set }): Promise<any> => {
      const targetBookUnit = await unitService.getByUnitId(params.unitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.unitId}`);
      }

      if (
        !hasPermissionToUpdateBook(identity, undefined, targetBookUnit as any)
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this book",
        );
      }

      return bookService.updateChapterIndex(params.unitId, body);
    },
    {
      requireLogin: true,
      params: bookParamsSchema,
      body: t.Any(),
      detail: {
        summary: "Update book chapter index",
        description: "Update the chapter index of a book by unit ID",
        tags: ["Books"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (identity.role !== "ADMIN" && identity.role !== "ROOT") {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to delete this book",
        );
      }

      const targetBookUnit = await unitService.getByUnitId(params.unitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.unitId}`);
      }

      if (targetBookUnit.userId !== identity.unitId) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to delete this book",
        );
      }

      await bookService.delete(params.unitId);
      return { message: "Book deleted successfully" };
    },
    {
      requireLogin: true,
      params: bookParamsSchema,
      detail: {
        summary: "Delete book",
        description: "Delete a book and its related unit by unit ID",
        tags: ["Books"],
      },
    },
  );
