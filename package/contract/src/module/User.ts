// user.ts
import { z } from "zod";
import { phone, email, username, password, id as idSchema, created_at, updated_at } from "./common";

// ------------------------------------------------------------------
// User Profile
// ------------------------------------------------------------------
export const UserSchema = z.object({
    id: idSchema,
    username, // 用户名
    email, // 邮箱
    phone: phone.optional(), // 手机号可选（不在数据库但留作扩展）
    name: z.string().min(1).max(50).describe("Full name"), // corresponds to Person.name
    avatar: z.url().optional(),
    description: z.string().optional(),
    createdAt: created_at,
    updatedAt: updated_at,
});
export type User = z.infer<typeof UserSchema>;

export const UserPreviewSchema = z.object({
    id: idSchema,
    username,
    avatar: z.url().optional(),
});
export type UserPreview = z.infer<typeof UserPreviewSchema>;

// ------------------------------------------------------------------
// Auth Payloads
// ------------------------------------------------------------------
export const SignupBodySchema = z.object({
    username,
    email,
    password,
    phone: phone.optional(),
});
export type SignupBody = z.infer<typeof SignupBodySchema>;

export const LoginBodySchema = z
    .object({
        username: z.string().optional(),
        email: z.string().optional(),
        password,
    })
    .refine((data) => data.username || data.email, {
        message: "Must provide username or email",
    });
export type LoginBody = z.infer<typeof LoginBodySchema>;
