import {
  createPostSchema,
  editorialPatchSubmissionSchema,
  hasPermissionToDeletePost,
  hasPermissionToUpdatePost,
  PostKind,
  type PostListResponse,
  type PostResponse,
  postListBodySchema,
  postListQuerySchema,
  postListResponseSchema,
  postParamsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import {
  applySparsePatch,
  assertEditorialPatchAllowed,
} from "@/unit/collaborative-metadata";
import { mapPostToDTO } from "./post.mapper";
import { postService } from "./post.service";

export const postApi = new Elysia({ prefix: "/post" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ headers, params }): Promise<PostResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const post = await postService.getByUnitId(params.unitId, {
        isAdmin: isAdminRole(identity),
      });
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
    "/list",
    async ({ headers, query }): Promise<PostListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const admin = isAdminRole(identity);

      const { posts, total } = query.realmUnitId
        ? await postService.byRealm(query.realmUnitId, query, {
            isAdmin: admin,
          })
        : await postService.list(query, {
            isAdmin: admin,
          });
      return { posts: posts.map(mapPostToDTO), total };
    },
    {
      query: postListQuerySchema,
      response: postListResponseSchema,
      detail: {
        summary: "List posts",
        description:
          "List posts with filters and pagination. Public callers see only published posts; admins have full access.",
        tags: ["Posts"],
      },
    },
  )
  .post(
    "/list",
    async ({ headers, body }): Promise<PostListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const admin = isAdminRole(identity);

      const query = { ...body, ids: body.ids?.join(",") };
      const { posts, total } = body.realmUnitId
        ? await postService.byRealm(body.realmUnitId, query, {
            isAdmin: admin,
          })
        : await postService.list(query, { isAdmin: admin });
      return { posts: posts.map(mapPostToDTO), total };
    },
    {
      body: postListBodySchema,
      response: postListResponseSchema,
      detail: {
        summary: "List posts (POST)",
        description:
          "List posts via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Posts"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<PostResponse> => {
      const post = await postService.create(body, identity.userId);
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
  .patch(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<PostResponse> => {
      assertEditorialPatchAllowed(body.patch);
      const target = await postService.getByUnitId(params.unitId);
      const postPatch =
        body.patch.post &&
        typeof body.patch.post === "object" &&
        !Array.isArray(body.patch.post)
          ? (body.patch.post as Record<string, unknown>)
          : {};
      const updateInput = {
        content:
          postPatch.content !== undefined
            ? applySparsePatch(target.content, postPatch.content)
            : undefined,
        isLocked:
          typeof postPatch.isLocked === "boolean"
            ? postPatch.isLocked
            : undefined,
        extra:
          postPatch.extra !== undefined
            ? ((postPatch.extra ?? null) as Record<string, unknown> | null)
            : undefined,
      };
      const isWikiContentOnlyEdit =
        target.kind === PostKind.WIKI &&
        updateInput.content !== undefined &&
        updateInput.isLocked === undefined &&
        updateInput.extra === undefined;

      if (
        !isWikiContentOnlyEdit &&
        !hasPermissionToUpdatePost(
          identity.permission,
          identity.userId,
          target.unit as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this post",
        );
      }
      const updated = await postService.update(
        params.unitId,
        updateInput as never,
        identity,
        body,
      );
      return mapPostToDTO(updated);
    },
    {
      requireLogin: true,
      params: postParamsSchema,
      body: editorialPatchSubmissionSchema,
      detail: {
        summary: "Update post",
        description: "Update an existing post with an editorial PATCH body",
        tags: ["Posts"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await postService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeletePost(
          identity.permission,
          identity.userId,
          target.unit as any,
        )
      ) {
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
