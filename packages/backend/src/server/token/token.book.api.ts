import {
  bookParamsSchema,
  createBookSchema,
  updateBookSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { bookService } from "../book/book.service";
import {
  hasPermissionToCreateBook,
  hasPermissionToReadBook,
  hasPermissionToUpdateBook,
} from "./permission";
import { tokenService } from "./token.service";

const tokenAuthHeaders = t.Object(
  {
    authorization: t.String(),
  },
  {
    additionalProperties: true,
  },
);

export const bookRoute = new Elysia()
  /**
   * Token-authenticated: Get book by unitId
   * GET /token/books/:unitId
   * 令牌认证：按 unitId 获取 book。
   * GET /token/books/:unitId
   */
  .get(
    "/books/:unitId",
    async ({ headers, set, params, request }) => {
      const ip =
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null;
      const userAgent = request.headers.get("user-agent") ?? null;

      const { scopes } = await tokenService.authenticateFromHeader(
        headers.authorization,
        { status: set.status as number | undefined },
        { ip, userAgent },
      );

      if (!hasPermissionToReadBook(scopes)) {
        set.status = 403;
        throw new Error("Forbidden: token does not have book:read scope");
      }

      const book = await bookService.getByUnitId(params.unitId);

      // Reuse existing DTO mapper through the book service index
      // 通过 book 服务索引复用现有的 DTO 映射器。
      const { mapBookToDTO } = await import("../book/mapper");
      return mapBookToDTO(book as any);
    },
    {
      params: bookParamsSchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: "Get book (token)",
        description:
          "Get a single book by unit ID using an API token instead of JWT auth",
        tags: ["Token", "Books"],
      },
    },
  )

  /**
   * Token-authenticated: Create a book
   * POST /token/books
   * 令牌认证：创建 book。
   * POST /token/books
   */
  .post(
    "/books",
    async ({ headers, set, body, request }) => {
      const ip =
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null;
      const userAgent = request.headers.get("user-agent") ?? null;

      const { userId, scopes } = await tokenService.authenticateFromHeader(
        headers.authorization,
        { status: set.status as number | undefined },
        { ip, userAgent },
      );

      if (!hasPermissionToCreateBook(scopes)) {
        set.status = 403;
        throw new Error("Forbidden: token does not have book:write scope");
      }

      // Force owner to be the token's user
      // 强制将所有者设为该令牌的用户。
      const created = await bookService.create({
        ...body,
        userId,
      } as any);

      const { mapBookToDTO } = await import("../book/mapper");
      return mapBookToDTO(created as any);
    },
    {
      body: createBookSchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: "Create book (token)",
        description:
          "Create a new book owned by the token user, authenticated via API token",
        tags: ["Token", "Books"],
      },
    },
  )

  /**
   * Token-authenticated: Update a book
   * PUT /token/books/:unitId
   * 令牌认证：更新 book。
   * PUT /token/books/:unitId
   */
  .put(
    "/books/:unitId",
    async ({ headers, set, params, body, request }) => {
      const ip =
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null;
      const userAgent = request.headers.get("user-agent") ?? null;

      const { scopes } = await tokenService.authenticateFromHeader(
        headers.authorization,
        { status: set.status as number | undefined },
        { ip, userAgent },
      );

      if (!(await hasPermissionToUpdateBook(scopes))) {
        set.status = 403;
        throw new Error("Forbidden: token does not have book:write scope");
      }

      const updated = await bookService.update(params.unitId, body as any);
      const { mapBookToDTO } = await import("../book/mapper");
      return mapBookToDTO(updated as any);
    },
    {
      params: bookParamsSchema,
      body: updateBookSchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: "Update book (token)",
        description:
          "Update a book by unit ID using an API token, restricted to the token owner",
        tags: ["Token", "Books"],
      },
    },
  )

  /**
   * Token-authenticated: Delete a book
   * DELETE /token/books/:unitId
   * 令牌认证：删除 book。
   * DELETE /token/books/:unitId
   */
  .delete(
    "/books/:unitId",
    async ({ set }) => {
      set.status = 403;
      return {
        message: "Forbidden: now don't allow use token to delete book",
      };
    },
    {
      params: bookParamsSchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: "Delete book (token)",
        description:
          "Delete a book and its related unit by unit ID using an API token",
        tags: ["Token", "Books"],
      },
    },
  );
