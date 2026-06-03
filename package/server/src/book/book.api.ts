import type {
  AiDisclosureDetails,
  AiDisclosureMode,
  BookContentStructureResponse,
  BookListResponse,
  BookResponse,
  ContentRating,
  CreateBookInput,
  LicenseSlug,
  ScoreAggregateDTO,
} from "@rezics/contract";
import {
  aiDisclosureDetailsSchema,
  aiDisclosureModeSchema,
  bookListBodySchema,
  bookListQuerySchema,
  bookParamsSchema,
  bookReadQuerySchema,
  createBookSchema,
  editorialPatchSubmissionSchema,
  hasPermissionToUpdateBook,
} from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";
import { Elysia, status, t } from "elysia";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { mapScoreAggregateToDTO } from "@/score/score.mapper";
import { scoreService } from "@/score/score.service";
import { assertEditorialPatchAllowed } from "@/unit/collaborative-metadata";
import { resolveEffectiveReadLanguageCandidates } from "@/unit/language-resolution";
import { publicUnitEligibilityWhere } from "@/unit/publication-policy";
import { unitService } from "@/unit/unit.service";
import { bookService } from "./book.service";
import { mapBookToDTO } from "./mapper";

export const bookApi = new Elysia({ prefix: "/book" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params, query }): Promise<BookResponse> => {
      const book = await bookService.getByUnitId(params.unitId);
      const languages = resolveEffectiveReadLanguageCandidates({
        languages: query.languages,
      });
      return mapBookToDTO(book, languages);
    },
    {
      params: bookParamsSchema,
      query: bookReadQuerySchema,
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
    "/:unitId/content-structure",
    async ({ params }): Promise<BookContentStructureResponse> => {
      return bookService.getContentStructureByBookUnitId(params.unitId);
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: "Get content structure",
        description: "Get content structure by bookUnitId",
        tags: ["Books"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<BookResponse> => {
      const bookReq: CreateBookInput = {
        ...body,
        userId: identity.userId,
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
    "/list",
    async ({ headers, query }): Promise<BookListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const admin = isAdminRole(identity);

      const effectiveQuery = admin
        ? query
        : {
            ...query,
            status: publicUnitEligibilityWhere.status,
            visibility: publicUnitEligibilityWhere.visibility,
          };

      const { books, total } = await bookService.list(effectiveQuery);
      const languages = resolveEffectiveReadLanguageCandidates({
        languages: query.languages,
      });
      return {
        books: books.map((book) => mapBookToDTO(book, languages)),
        total,
      };
    },
    {
      query: bookListQuerySchema,
      detail: {
        summary: "List books",
        description:
          "List books with filters and pagination. Public callers see only published/public books; admins have full filter access.",
        tags: ["Books"],
      },
    },
  )
  .post(
    "/list",
    async ({ headers, body }): Promise<BookListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const admin = isAdminRole(identity);

      const query = { ...body, ids: body.ids?.join(",") };
      const effectiveQuery = admin
        ? query
        : {
            ...query,
            status: publicUnitEligibilityWhere.status,
            visibility: publicUnitEligibilityWhere.visibility,
          };

      const { books, total } = await bookService.list(effectiveQuery);
      const languages = resolveEffectiveReadLanguageCandidates({
        languages: body.languages,
      });
      return {
        books: books.map((book) => mapBookToDTO(book, languages)),
        total,
      };
    },
    {
      body: bookListBodySchema,
      detail: {
        summary: "List books (POST)",
        description:
          "List books via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Books"],
      },
    },
  )
  .patch(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<BookResponse> => {
      assertEditorialPatchAllowed(body.patch);
      const targetBookUnit = await unitService.getByUnitId(params.unitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.unitId}`);
      }

      const extension =
        body.patch.extension &&
        typeof body.patch.extension === "object" &&
        !Array.isArray(body.patch.extension)
          ? (body.patch.extension as Record<string, unknown>)
          : {};
      const unit =
        body.patch.unit &&
        typeof body.patch.unit === "object" &&
        !Array.isArray(body.patch.unit)
          ? (body.patch.unit as Record<string, unknown>)
          : {};
      const book = await bookService.update(
        params.unitId,
        {
          isbn13:
            extension.isbn13 === null || typeof extension.isbn13 === "string"
              ? extension.isbn13
              : undefined,
          publicationDate:
            extension.publicationDate === null ||
            typeof extension.publicationDate === "string" ||
            extension.publicationDate instanceof Date
              ? extension.publicationDate
              : undefined,
          pageCount:
            extension.pageCount === null ||
            typeof extension.pageCount === "number"
              ? extension.pageCount
              : undefined,
          textLength:
            typeof extension.textLength === "number"
              ? extension.textLength
              : undefined,
          formatKey:
            extension.formatKey === null ||
            typeof extension.formatKey === "string"
              ? extension.formatKey
              : undefined,
          isLicensed:
            typeof extension.isLicensed === "boolean"
              ? extension.isLicensed
              : undefined,
          coverUrl:
            extension.coverUrl === null ||
            typeof extension.coverUrl === "string"
              ? extension.coverUrl
              : undefined,
          extra:
            extension.extra === null ||
            (typeof extension.extra === "object" &&
              !Array.isArray(extension.extra))
              ? (extension.extra as Record<string, unknown> | null)
              : undefined,
          rating:
            typeof unit.rating === "string"
              ? (unit.rating as ContentRating)
              : undefined,
          aiDisclosureMode: Value.Check(
            aiDisclosureModeSchema,
            unit.aiDisclosureMode,
          )
            ? (unit.aiDisclosureMode as AiDisclosureMode)
            : undefined,
          aiDisclosureDetails:
            unit.aiDisclosureDetails === null ||
            Value.Check(aiDisclosureDetailsSchema, unit.aiDisclosureDetails)
              ? (unit.aiDisclosureDetails as AiDisclosureDetails | null)
              : undefined,
          visibility:
            typeof unit.visibility === "string" ? unit.visibility : undefined,
          licenseSlug:
            unit.license === null || typeof unit.license === "string"
              ? (unit.license as LicenseSlug | null)
              : undefined,
        },
        identity,
        body,
      );
      return mapBookToDTO(book);
    },
    {
      requireLogin: true,
      params: bookParamsSchema,
      body: editorialPatchSubmissionSchema,
      detail: {
        summary: "Update book",
        description: "Update an existing book by unit ID with editorial PATCH",
        tags: ["Books"],
      },
    },
  )
  .put(
    "/:unitId/content-structure",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<BookContentStructureResponse> => {
      const targetBookUnit = await unitService.getByUnitId(params.unitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.unitId}`);
      }

      if (
        !hasPermissionToUpdateBook(
          identity.permission,
          identity.userId,
          undefined,
          targetBookUnit as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this book",
        );
      }

      return bookService.updateContentStructure(params.unitId, body, {
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      params: bookParamsSchema,
      body: t.Any(),
      detail: {
        summary: "Update book content structure",
        description: "Update the content structure of a book by unit ID",
        tags: ["Books"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
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

      if (targetBookUnit.userId !== identity.userId) {
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
