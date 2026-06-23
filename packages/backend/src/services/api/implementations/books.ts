import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  Book,
  ContentStructure,
  ContentStructureNode,
  ContentTranslation,
  ScoreAggregate,
  Series,
  SeriesContentIndex,
  Unit,
  UnitTranslation,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  BookDTO,
  BookForbidden,
  BookListResult,
  BookNotFound,
  ChapterDTO,
  ChapterForbidden,
  ChapterMaterializationResult,
  ChapterNotFound,
  ContentStructureDTO,
  ContentStructureNodeDTO,
  ScoreAggregateDTO,
  SeriesContentIndexRow,
  SeriesDTO,
  SeriesDetailDTO,
  SeriesForbidden,
  SeriesNotFound,
} from "../interfaces/books.ts";

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

function bookToDTO(
  unit: typeof Unit.$inferSelect,
  book: typeof Book.$inferSelect,
) {
  return new BookDTO({
    unitId: unit.id,
    type: unit.type,
    slug: unit.slug ?? null,
    status: unit.status,
    visibility: unit.visibility,
    isbn13: book.isbn13 ?? null,
    pageCount: book.pageCount ?? null,
    textLength: book.textLength,
    chapterCount: book.chapterCount,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  });
}

function nodeToDTO(n: typeof ContentStructureNode.$inferSelect) {
  return new ContentStructureNodeDTO({
    id: n.id,
    parentId: n.parentId ?? null,
    position: n.position,
    contentUnitId: n.contentUnitId ?? null,
    title: n.title,
    noContent: n.noContent,
  });
}

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const BooksHandlers = HttpApiBuilder.group(
  Api,
  "books",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) =>
      Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    const fetchBook = (unitId: string) =>
      database
        .select()
        .from(Book)
        .innerJoin(Unit, eq(Book.unitId, Unit.id))
        .where(eq(Book.unitId, unitId))
        .pipe(Effect.map((rows) => rows[0] ?? null));

    const listBooksShared = (opts: {
      userId?: string;
      status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED";
      search?: string;
      ids?: readonly string[];
      limit?: number;
      offset?: number;
    }) =>
      Effect.gen(function* () {
        const conditions: ReturnType<typeof eq>[] = [eq(Unit.type, "BOOK")];
        if (opts.userId) conditions.push(eq(Unit.userId, opts.userId));
        if (opts.status)
          conditions.push(eq(Unit.status, opts.status));
        if (opts.ids && opts.ids.length > 0)
          conditions.push(inArray(Book.unitId, [...opts.ids]));
        if (opts.search) conditions.push(ilike(Unit.slug, `%${opts.search}%`));
        const where = and(...conditions);
        const rows = yield* database
          .select()
          .from(Book)
          .innerJoin(Unit, eq(Book.unitId, Unit.id))
          .where(where)
          .orderBy(desc(Unit.createdAt))
          .limit(lim(opts.limit))
          .offset(opts.offset ?? 0);
        const agg = yield* database
          .select({ total: count() })
          .from(Book)
          .innerJoin(Unit, eq(Book.unitId, Unit.id))
          .where(where);
        return new BookListResult({
          books: rows.map((r) => bookToDTO(r.Unit, r.Book)),
          total: agg[0]?.total ?? 0,
        });
      });

    return (
      handlers
        // ── Book CRUD ──────────────────────────────────────────────
        .handle("getBook", ({ params }) =>
          Effect.gen(function* () {
            const row = yield* fetchBook(params.unitId);
            if (!row) return yield* new BookNotFound();
            return bookToDTO(row.Unit, row.Book);
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("createBook", ({ payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const lang = payload.defaultLanguage ?? "en";
            const units = yield* database
              .insert(Unit)
              .values({
                type: "BOOK",
                userId: user.id,
                slugScope: user.id,
                defaultLanguage: lang,
                status: payload.status ?? "DRAFT",
                visibility: "PUBLIC",
              })
              .returning();
            const unit = units[0]!;
            yield* database.insert(UnitTranslation).values({
              unitId: unit.id,
              language: lang,
              title: payload.title,
              extra: payload.coverUrl
                ? { coverUrl: payload.coverUrl }
                : undefined,
            });
            const books = yield* database
              .insert(Book)
              .values({
                unitId: unit.id,
                isbn13: payload.isbn13,
                pageCount: payload.pageCount,
              })
              .returning();
            yield* database
              .insert(ContentStructure)
              .values({ ownerUnitId: unit.id });
            return bookToDTO(unit, books[0]!);
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("updateBook", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const row = yield* fetchBook(params.unitId);
            if (!row) return yield* new BookNotFound();
            if (row.Unit.userId !== user.id) return yield* new BookForbidden();
            const patch = payload.patch;
            const unitSet: Record<string, unknown> = { updatedAt: new Date() };
            const bookSet: Record<string, unknown> = { updatedAt: new Date() };
            if ("status" in patch) unitSet["status"] = patch["status"];
            if ("visibility" in patch)
              unitSet["visibility"] = patch["visibility"];
            if ("rating" in patch) unitSet["rating"] = patch["rating"];
            if ("isbn13" in patch) bookSet["isbn13"] = patch["isbn13"];
            if ("pageCount" in patch) bookSet["pageCount"] = patch["pageCount"];
            if ("publicationDate" in patch)
              bookSet["publicationDate"] = patch["publicationDate"];
            if ("formatKey" in patch) bookSet["formatKey"] = patch["formatKey"];
            if ("isLicensed" in patch)
              bookSet["isLicensed"] = patch["isLicensed"];
            if (Object.keys(unitSet).length > 1) {
              yield* database
                .update(Unit)
                .set(unitSet)
                .where(eq(Unit.id, params.unitId));
            }
            if (Object.keys(bookSet).length > 1) {
              yield* database
                .update(Book)
                .set(bookSet)
                .where(eq(Book.unitId, params.unitId));
            }
            const updated = yield* fetchBook(params.unitId);
            return bookToDTO(updated!.Unit, updated!.Book);
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("deleteBook", ({ params }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const row = yield* fetchBook(params.unitId);
            if (!row) return yield* new BookNotFound();
            if (row.Unit.userId !== user.id) return yield* new BookForbidden();
            yield* database.delete(Unit).where(eq(Unit.id, params.unitId));
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        // ── Book rating ───────────────────────────────────────────
        .handle("getBookRating", ({ params }) =>
          Effect.gen(function* () {
            const rows = yield* database
              .select()
              .from(ScoreAggregate)
              .where(eq(ScoreAggregate.unitId, params.unitId));
            return rows.map(
              (r) =>
                new ScoreAggregateDTO({
                  realmUnitId: r.realm,
                  average: r.totalCount > 0 ? r.totalScore / r.totalCount : 0,
                  count: r.totalCount,
                }),
            );
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        // ── Content structure ─────────────────────────────────────
        .handle("getBookContentStructure", ({ params }) =>
          Effect.gen(function* () {
            const nodes = yield* database
              .select()
              .from(ContentStructureNode)
              .where(
                and(
                  eq(ContentStructureNode.ownerUnitId, params.unitId),
                  eq(ContentStructureNode.isDeleted, false),
                ),
              )
              .orderBy(ContentStructureNode.position);
            return new ContentStructureDTO({
              ownerUnitId: params.unitId,
              nodes: nodes.map(nodeToDTO),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("updateBookContentStructure", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const row = yield* fetchBook(params.unitId);
            if (!row) return yield* new BookNotFound();
            if (row.Unit.userId !== user.id) return yield* new BookForbidden();
            yield* database
              .delete(ContentStructureNode)
              .where(eq(ContentStructureNode.ownerUnitId, params.unitId));
            if (payload.length > 0) {
              yield* database.insert(ContentStructureNode).values(
                payload.map((n) => ({
                  id: n.id,
                  ownerUnitId: params.unitId,
                  parentId: n.parentId ?? null,
                  position: n.position,
                  title: n.title,
                  noContent: n.noContent ?? false,
                  contentUnitId: n.contentUnitId ?? null,
                })),
              );
            }
            const agg = yield* database
              .select({ cnt: count() })
              .from(ContentStructureNode)
              .where(
                and(
                  eq(ContentStructureNode.ownerUnitId, params.unitId),
                  eq(ContentStructureNode.isDeleted, false),
                  eq(ContentStructureNode.noContent, false),
                ),
              );
            yield* database
              .update(Book)
              .set({ chapterCount: agg[0]?.cnt ?? 0, updatedAt: new Date() })
              .where(eq(Book.unitId, params.unitId));
            const nodes = yield* database
              .select()
              .from(ContentStructureNode)
              .where(
                and(
                  eq(ContentStructureNode.ownerUnitId, params.unitId),
                  eq(ContentStructureNode.isDeleted, false),
                ),
              )
              .orderBy(ContentStructureNode.position);
            return new ContentStructureDTO({
              ownerUnitId: params.unitId,
              nodes: nodes.map(nodeToDTO),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        // ── Book list ──────────────────────────────────────────────
        .handle("listBooks", ({ query }) =>
          listBooksShared(query).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("listBooksByBody", ({ payload }) =>
          listBooksShared(payload).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        // ── Chapters ───────────────────────────────────────────────
        .handle("getChapter", ({ params }) =>
          Effect.gen(function* () {
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ChapterNotFound();
            const unit = units[0];
            const lang = unit.defaultLanguage ?? "en";
            const trans = yield* database
              .select()
              .from(UnitTranslation)
              .where(
                and(
                  eq(UnitTranslation.unitId, params.unitId),
                  eq(UnitTranslation.language, lang),
                ),
              );
            const ct = yield* database
              .select()
              .from(ContentTranslation)
              .where(
                and(
                  eq(ContentTranslation.unitId, params.unitId),
                  eq(ContentTranslation.language, lang),
                ),
              );
            return new ChapterDTO({
              unitId: unit.id,
              title: trans[0]?.title ?? "",
              content: ct[0] ? JSON.stringify(ct[0].content) : null,
              status: unit.status,
              targetUnitId: unit.targetUnitId ?? null,
              createdAt: unit.createdAt.toISOString(),
              updatedAt: unit.updatedAt.toISOString(),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("createChapter", ({ payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const lang = "en";
            const units = yield* database
              .insert(Unit)
              .values({
                type: "POST",
                userId: user.id,
                slugScope: user.id,
                defaultLanguage: lang,
                status: payload.status ?? "DRAFT",
                targetUnitId: payload.targetUnitId,
              })
              .returning();
            const unit = units[0]!;
            yield* database.insert(UnitTranslation).values({
              unitId: unit.id,
              language: lang,
              title: payload.title,
              extra: payload.coverUrl
                ? { coverUrl: payload.coverUrl }
                : undefined,
            });
            if (payload.content) {
              yield* database.insert(ContentTranslation).values({
                unitId: unit.id,
                language: lang,
                content: JSON.parse(payload.content),
              });
            }
            return new ChapterDTO({
              unitId: unit.id,
              title: payload.title,
              content: payload.content ?? null,
              status: unit.status,
              targetUnitId: unit.targetUnitId ?? null,
              createdAt: unit.createdAt.toISOString(),
              updatedAt: unit.updatedAt.toISOString(),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("updateChapter", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ChapterNotFound();
            if (units[0].userId !== user.id)
              return yield* new ChapterForbidden();
            const lang = units[0].defaultLanguage ?? "en";
            if (payload.status) {
              yield* database
                .update(Unit)
                .set({ status: payload.status, updatedAt: new Date() })
                .where(eq(Unit.id, params.unitId));
            }
            const transSet: Record<string, unknown> = { updatedAt: new Date() };
            if (payload.title) transSet["title"] = payload.title;
            if (payload.coverUrl !== undefined)
              transSet["extra"] = payload.coverUrl
                ? { coverUrl: payload.coverUrl }
                : null;
            yield* database
              .update(UnitTranslation)
              .set(transSet)
              .where(
                and(
                  eq(UnitTranslation.unitId, params.unitId),
                  eq(UnitTranslation.language, lang),
                ),
              );
            if (payload.content !== undefined) {
              const contentVal = payload.content
                ? JSON.parse(payload.content)
                : {};
              yield* database
                .insert(ContentTranslation)
                .values({
                  unitId: params.unitId,
                  language: lang,
                  content: contentVal,
                })
                .onConflictDoUpdate({
                  target: [
                    ContentTranslation.unitId,
                    ContentTranslation.language,
                  ],
                  set: { content: contentVal, updatedAt: new Date() },
                });
            }
            const updated = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            const trans = yield* database
              .select()
              .from(UnitTranslation)
              .where(
                and(
                  eq(UnitTranslation.unitId, params.unitId),
                  eq(UnitTranslation.language, lang),
                ),
              );
            const ct = yield* database
              .select()
              .from(ContentTranslation)
              .where(
                and(
                  eq(ContentTranslation.unitId, params.unitId),
                  eq(ContentTranslation.language, lang),
                ),
              );
            return new ChapterDTO({
              unitId: updated[0]!.id,
              title: trans[0]?.title ?? "",
              content: ct[0] ? JSON.stringify(ct[0].content) : null,
              status: updated[0]!.status,
              targetUnitId: updated[0]!.targetUnitId ?? null,
              createdAt: updated[0]!.createdAt.toISOString(),
              updatedAt: updated[0]!.updatedAt.toISOString(),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("deleteChapter", ({ params }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ChapterNotFound();
            if (units[0].userId !== user.id)
              return yield* new ChapterForbidden();
            yield* database.delete(Unit).where(eq(Unit.id, params.unitId));
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("materializeChapter", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const row = yield* fetchBook(params.bookUnitId);
            if (!row) return yield* new BookNotFound();
            if (row.Unit.userId !== user.id) return yield* new BookForbidden();
            const nodes = yield* database
              .select()
              .from(ContentStructureNode)
              .where(
                and(
                  eq(ContentStructureNode.id, payload.nodeId),
                  eq(ContentStructureNode.ownerUnitId, params.bookUnitId),
                ),
              );
            if (!nodes[0]) return yield* new ChapterNotFound();
            const node = nodes[0];
            if (node.contentUnitId) {
              return new ChapterMaterializationResult({
                unitId: node.contentUnitId,
                nodeId: node.id,
                created: false,
              });
            }
            const units = yield* database
              .insert(Unit)
              .values({
                type: "POST",
                userId: user.id,
                slugScope: user.id,
                defaultLanguage: row.Unit.defaultLanguage ?? "en",
                status: "DRAFT",
                targetUnitId: params.bookUnitId,
              })
              .returning();
            const unit = units[0]!;
            yield* database.insert(UnitTranslation).values({
              unitId: unit.id,
              language: unit.defaultLanguage ?? "en",
              title: node.title,
            });
            yield* database
              .update(ContentStructureNode)
              .set({ contentUnitId: unit.id, updatedAt: new Date() })
              .where(eq(ContentStructureNode.id, payload.nodeId));
            return new ChapterMaterializationResult({
              unitId: unit.id,
              nodeId: node.id,
              created: true,
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        // ── Series ─────────────────────────────────────────────────
        .handle("getSeries", ({ params }) =>
          Effect.gen(function* () {
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0] || units[0].type !== "SERIES")
              return yield* new SeriesNotFound();
            const unit = units[0];
            const nodes = yield* database
              .select()
              .from(ContentStructureNode)
              .where(
                and(
                  eq(ContentStructureNode.ownerUnitId, params.unitId),
                  eq(ContentStructureNode.isDeleted, false),
                ),
              )
              .orderBy(ContentStructureNode.position);
            const cs =
              nodes.length > 0
                ? new ContentStructureDTO({
                    ownerUnitId: params.unitId,
                    nodes: nodes.map(nodeToDTO),
                  })
                : null;
            return new SeriesDetailDTO({
              unitId: unit.id,
              type: unit.type,
              slug: unit.slug ?? null,
              status: unit.status,
              contentStructure: cs,
              createdAt: unit.createdAt.toISOString(),
              updatedAt: unit.updatedAt.toISOString(),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("createSeries", ({ payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const lang = payload.defaultLanguage ?? "en";
            const units = yield* database
              .insert(Unit)
              .values({
                type: "SERIES",
                userId: user.id,
                slugScope: user.id,
                defaultLanguage: lang,
                status: "DRAFT",
              })
              .returning();
            const unit = units[0]!;
            yield* database
              .insert(UnitTranslation)
              .values({
                unitId: unit.id,
                language: lang,
                title: payload.title,
              });
            yield* database
              .insert(Series)
              .values({ unitId: unit.id, kindKey: "default" });
            yield* database
              .insert(ContentStructure)
              .values({ ownerUnitId: unit.id });
            return new SeriesDTO({
              unitId: unit.id,
              type: unit.type,
              slug: unit.slug ?? null,
              status: unit.status,
              createdAt: unit.createdAt.toISOString(),
              updatedAt: unit.updatedAt.toISOString(),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("updateSeries", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0] || units[0].type !== "SERIES")
              return yield* new SeriesNotFound();
            if (units[0].userId !== user.id)
              return yield* new SeriesForbidden();
            const lang = units[0].defaultLanguage ?? "en";
            if (payload.title) {
              yield* database
                .update(UnitTranslation)
                .set({ title: payload.title, updatedAt: new Date() })
                .where(
                  and(
                    eq(UnitTranslation.unitId, params.unitId),
                    eq(UnitTranslation.language, lang),
                  ),
                );
            }
            if (payload.status) {
              yield* database
                .update(Unit)
                .set({ status: payload.status, updatedAt: new Date() })
                .where(eq(Unit.id, params.unitId));
            }
            const updated = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            return new SeriesDTO({
              unitId: updated[0]!.id,
              type: updated[0]!.type,
              slug: updated[0]!.slug ?? null,
              status: updated[0]!.status,
              createdAt: updated[0]!.createdAt.toISOString(),
              updatedAt: updated[0]!.updatedAt.toISOString(),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("updateSeriesContentStructure", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0] || units[0].type !== "SERIES")
              return yield* new SeriesNotFound();
            if (units[0].userId !== user.id)
              return yield* new SeriesForbidden();
            yield* database
              .delete(ContentStructureNode)
              .where(eq(ContentStructureNode.ownerUnitId, params.unitId));
            if (payload.length > 0) {
              yield* database.insert(ContentStructureNode).values(
                payload.map((n) => ({
                  id: n.id,
                  ownerUnitId: params.unitId,
                  parentId: n.parentId ?? null,
                  position: n.position,
                  title: n.title,
                  noContent: n.noContent ?? false,
                  contentUnitId: n.contentUnitId ?? null,
                })),
              );
            }
            const nodes = yield* database
              .select()
              .from(ContentStructureNode)
              .where(
                and(
                  eq(ContentStructureNode.ownerUnitId, params.unitId),
                  eq(ContentStructureNode.isDeleted, false),
                ),
              )
              .orderBy(ContentStructureNode.position);
            return new ContentStructureDTO({
              ownerUnitId: params.unitId,
              nodes: nodes.map(nodeToDTO),
            });
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )

        .handle("getSeriesContentIndex", ({ params }) =>
          Effect.gen(function* () {
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0] || units[0].type !== "SERIES")
              return yield* new SeriesNotFound();
            const rows = yield* database
              .select()
              .from(SeriesContentIndex)
              .innerJoin(
                ContentStructureNode,
                eq(SeriesContentIndex.contentNodeId, ContentStructureNode.id),
              )
              .where(eq(SeriesContentIndex.seriesUnitId, params.unitId));
            return {
              rows: rows.map(
                (r) =>
                  new SeriesContentIndexRow({
                    nodeId: r.ContentStructureNode.id,
                    contentUnitId: r.ContentStructureNode.contentUnitId ?? null,
                    position: r.ContentStructureNode.position,
                    title: r.ContentStructureNode.title,
                  }),
              ),
            };
          }).pipe(
            Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
          ),
        )
    );
  }),
);
