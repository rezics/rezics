// common.ts
import { z } from "zod";
import { PhoneNumberUtil, PhoneNumberFormat } from "google-libphonenumber";

const phone_util = PhoneNumberUtil.getInstance();

// ---------------- Pagination ----------------
export const PaginationQuerySchema = z.object({
    page: z.number().int().optional().default(1),
    limit: z.number().int().optional().default(20),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
    z.object({
        items: z.array(item),
        page: z.number(),
        totalPages: z.number(),
        total: z.number(),
    });

// ---------------- Primitives ----------------
export const id = z.string().uuid().describe("UUIDv4 ID");

export const username = z
    .string()
    .min(3)
    .max(27)
    .regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric and underscore")
    .describe("username");

export const email = z.string().email().max(100).describe("email");

export const phone = z
    .string()
    .min(4)
    .max(16)
    .refine((v) => {
        try {
            phone_util.parse(v);
            return true;
        } catch {
            return false;
        }
    }, "Invalid phone number")
    .transform((v) => phone_util.format(phone_util.parse(v), PhoneNumberFormat.E164))
    .describe("phone number");

export const password = z.string().min(6).max(24).describe("password");

// ---------------- Content Lengths ----------------
export const content = {
    short: z.string().min(1).max(1000).describe("short content"),
    medium: z.string().min(1).max(5000).describe("medium content"),
    long: z.string().min(1).max(100000).describe("long content"),
};

// ---------------- Timestamps ----------------
export const created_at = z.string().describe("ISO created timestamp");
export const updated_at = z.string().describe("ISO updated timestamp");
