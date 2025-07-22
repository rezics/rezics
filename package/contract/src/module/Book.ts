import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse, id as idSchema, created_at, updated_at } from "./common";
import { TagSchema } from "./Tag";
import { UserSchema } from "./User";

// ------------------------------------------------------------------
// Author Schema (matches `Author` in database)
// ------------------------------------------------------------------
export const AuthorSchema = z.object({
    id: idSchema,
    name: z.string(),
    description: z.string().optional(),
    // Each author could be linked to a user profile
    userId: idSchema.optional(),
    tags: z.array(TagSchema).optional(),
});
export type Author = z.infer<typeof AuthorSchema>;

// ------------------------------------------------------------------
// Book Schema (matches `Book` in database)
// ------------------------------------------------------------------
export const BookSchema = z.object({
    id: idSchema,
    name: z.string(),
    cover: z.string().url().optional(),
    releasedAt: z.string().optional(),
    realUpdatedAt: z.string().optional(),
    grabbedFrom: z.string(),
    description: z.string(),
    length: z.number(),
    authors: z.array(AuthorSchema),
    units: z.array(z.string()).optional(), // references to Unit IDs
    platforms: z.array(z.string()).optional(), // references to Platform IDs
    tags: z.array(TagSchema).optional(),
    createdAt: created_at,
    updatedAt: updated_at,
});
export type Book = z.infer<typeof BookSchema>;

// ------------------------------------------------------------------
// Unit (Chapter) Schema (matches `Unit` in database)
// ------------------------------------------------------------------
export const UnitSchema = z.object({
    id: idSchema,
    name: z.string(),
    order: z.number().int(),
    parentId: idSchema.optional(),
    childrenIds: z.array(idSchema).optional(),
    tags: z.array(TagSchema).optional(),
});
export type Unit = z.infer<typeof UnitSchema>;
// The rest of the API relies on an order map of units
export const UnitOrderSchema = z.map(idSchema, z.array(idSchema));
export type UnitOrder = z.infer<typeof UnitOrderSchema>;

export const UnitContentSchema = z.object({
    id: idSchema,
    content: z.string(),
    createdAt: created_at,
    unitName: z.string(),
    author: UserSchema,
});
export type UnitContent = z.infer<typeof UnitContentSchema>;

// ANCHOR BookRouter
const c = initContract();

export const bookRouter = c.router({
    get: {
        method: "GET",
        path: "/book/:bookId",
        responses: { 200: BookSchema, 404: z.object({ message: z.string() }) },
    },
    update: {
        method: "PUT",
        path: "/book/:id",
        body: BookSchema.partial().omit({ id: true }),
        responses: { 200: BookSchema, 404: z.object({ message: z.string() }) },
    },
    list: {
        method: "GET",
        path: "/book",
        query: PaginationQuerySchema.extend({ q: z.string().optional() }),
        responses: { 200: PaginatedResponse(BookSchema) },
    },
    search: {
        method: "GET",
        path: "/book/search",
        query: z.object({ query: z.string() }).merge(PaginationQuerySchema.partial()),
        responses: { 200: PaginatedResponse(BookSchema) },
    },
    top: {
        method: "GET",
        path: "/book/top",
        responses: { 200: z.array(BookSchema) },
    },
    unit: c.router({
        list: {
            method: "GET",
            path: "/book/:bookId/units",
            responses: { 200: z.object({ units: z.array(UnitSchema), order: UnitOrderSchema }) },
        },
        content: {
            method: "GET",
            path: "/book/:bookId/unit/:unitId",
            responses: { 200: UnitContentSchema },
        },
    }),
});

export type BookRouter = typeof bookRouter;
