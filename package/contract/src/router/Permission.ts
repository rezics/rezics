import c from "./c";
import { z } from "zod";
import { Permission } from "../schema/Permission";

export const PermissionRouter = c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/permissions",
        body: Permission.Create,
        responses: {
            201: Permission.View,
        },
    },
    read: {
        method: "GET",
        path: "/permissions/:id",
        query: Permission.Read,
        responses: {
            200: Permission.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/permissions/:id",
        body: Permission.Update,
        responses: {
            200: Permission.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/permissions/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },
    
    // Extended permission-specific endpoints
    getUserPermissions: {
        method: "GET",
        path: "/users/:userId/permissions",
        responses: {
            200: Permission.View,
        },
    },
    updateUserPermissions: {
        method: "PUT",
        path: "/users/:userId/permissions",
        body: Permission.Update,
        responses: {
            200: Permission.View,
        },
    },
    checkPermission: {
        method: "POST",
        path: "/permissions/check",
        body: z.object({
            userId: z.string(),
            resource: z.enum(["user", "book", "tag", "root"]),
            action: z.enum(["read", "write", "delete", "admin"]),
        }),
        responses: {
            200: z.object({
                allowed: z.boolean(),
                permission: z.enum(["none", "read-only", "read-write"]),
                reason: z.string().optional(),
            }),
        },
    },
    listUsersByPermission: {
        method: "GET",
        path: "/permissions/users",
        query: z.object({
            resource: z.enum(["user", "book", "tag", "root"]).optional(),
            access: z.enum(["none", "read-only", "read-write"]).optional(),
            hasRoot: z.boolean().optional(),
        }),
        responses: {
            200: z.array(z.object({
                userId: z.string(),
                userName: z.string(),
                permissions: Permission.View,
            })),
        },
    },
    grantPermission: {
        method: "POST",
        path: "/permissions/grant",
        body: z.object({
            userId: z.string(),
            resource: z.enum(["user", "book", "tag"]),
            access: z.enum(["read-only", "read-write"]),
            grantedBy: z.string(),
        }),
        responses: {
            201: z.object({
                message: z.string(),
                permissions: Permission.View,
            }),
        },
    },
    revokePermission: {
        method: "POST",
        path: "/permissions/revoke",
        body: z.object({
            userId: z.string(),
            resource: z.enum(["user", "book", "tag"]),
            revokedBy: z.string(),
        }),
        responses: {
            200: z.object({
                message: z.string(),
                permissions: Permission.View,
            }),
        },
    },
    getPermissionHistory: {
        method: "GET",
        path: "/permissions/:id/history",
        responses: {
            200: z.array(z.object({
                action: z.enum(["granted", "revoked", "updated"]),
                resource: z.string(),
                oldValue: z.string().optional(),
                newValue: z.string().optional(),
                changedBy: z.string(),
                timestamp: z.date(),
            })),
        },
    },
    bulkUpdatePermissions: {
        method: "POST",
        path: "/permissions/bulk-update",
        body: z.object({
            updates: z.array(z.object({
                userId: z.string(),
                permissions: Permission.Update,
            })),
            updatedBy: z.string(),
        }),
        responses: {
            200: z.object({
                successful: z.array(z.object({
                    userId: z.string(),
                    permissions: Permission.View,
                })),
                failed: z.array(z.object({
                    userId: z.string(),
                    error: z.string(),
                })),
                summary: z.object({
                    total: z.number(),
                    successful: z.number(),
                    failed: z.number(),
                }),
            }),
        },
    },
});

export default PermissionRouter;