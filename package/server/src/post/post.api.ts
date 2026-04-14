import {
  BasicAdminPermission,
  createPostSchema,
  hasPermissionToDeletePost,
  hasPermissionToUpdatePost,
  type PostListResponse,
  type PostResponse,
  postListQuerySchema,
  postListResponseSchema,
  postParamsSchema,
  updatePostSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { mapPostToDTO } from "./post.mapper";
import { postService } from "./post.service";

export const postApi = new Elysia({ prefix: "/posts" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<PostResponse> => {
      const post = await postService.getByUnitId(params.unitId);
      return mapPostToDTO(post);
    },
    {
      params: postParamsSchema,
      detail: {
        summary: "Get post",
        description: "Get a single post by unit ID",
        tags: ["Posts"],
      },
    },
  )
  .get(
    "/",
    async ({ query, identity, set }): Promise<PostListResponse> => {
      // Unscoped listing (no targetUnitId or realmUnitId) requires admin
      const isScoped = !!(query.targetUnitId || query.realmUnitId);

      if (!isScoped && !BasicAdminPermission(identity)) {
        set.status = 403;
        throw new Error(
          "Forbidden: unscoped post listing requires admin permission",
        );
      }

      const { posts, total } = await postService.list(query);
      return { posts: posts.map(mapPostToDTO), total };
    },
    {
      requireLogin: true,
      query: postListQuerySchema,
      response: postListResponseSchema,
      detail: {
        summary: "List posts",
        description:
          "List posts with filters. Unscoped listing requires admin; scoped by targetUnitId or realmUnitId is open.",
        tags: ["Posts"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<PostResponse> => {
      const post = await postService.create(body, identity.unitId);
      return mapPostToDTO(post);
    },
    {
      requireLogin: true,
      body: createPostSchema,
      detail: {
        summary: "Create post",
        description:
          "Create a new post. If parentPostUnitId is provided, creates a reply with threaded tree handling.",
        tags: ["Posts"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<PostResponse> => {
      const target = await postService.getByUnitId(params.unitId);
      if (!hasPermissionToUpdatePost(identity, target.unit as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this post",
        );
      }
      const updated = await postService.update(params.unitId, body);
      return mapPostToDTO(updated);
    },
    {
      requireLogin: true,
      params: postParamsSchema,
      body: updatePostSchema,
      detail: {
        summary: "Update post",
        description: "Update an existing post (body, isLocked, extra)",
        tags: ["Posts"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await postService.getByUnitId(params.unitId);
      if (!hasPermissionToDeletePost(identity, target.unit as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to delete this post",
        );
      }
      await postService.delete(params.unitId);
      return { message: "Post deleted successfully" };
    },
    {
      requireLogin: true,
      params: postParamsSchema,
      detail: {
        summary: "Delete post",
        description: "Delete a post by unit ID",
        tags: ["Posts"],
      },
    },
  );
