import {
  acceptAnswerSchema,
  commentPromotionDTOSchema,
  createPostSchema,
  editorialPatchSubmissionSchema,
  hasPermissionToUpdatePost,
  isBlocked,
  normalizeLanguage,
  PostKind,
  type PostListQuery,
  type PostListResponse,
  type PostModerationOverlayResponse,
  type PostResponse,
  parseReadLanguages,
  pinCommentSchema,
  postListBodySchema,
  postListQuerySchema,
  postListResponseSchema,
  postModerationOverlayRequestSchema,
  postModerationOverlayResponseSchema,
  postParamsSchema,
  setPostPublicationSchema,
  setPostStateSchema,
  submitPostToRealmSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import {
  contentPolicyActions,
  governanceModerationService,
  governanceRoutePolicyService,
} from "@/governance";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import {
  applySparsePatch,
  assertEditorialPatchAllowed,
} from "@/unit/collaborative-metadata";
import { hydrateVariantContextSummaries } from "@/unit/variant-context";
import { mapPostToDTO } from "./post.mapper";
import { postService } from "./post.service";

async function assertPostDeletePolicy(input: {
  identity: any;
  status: any;
  target: any;
}) {
  if (isBlocked(input.identity.permission)) {
    return input.status(403, "Forbidden: blocked users cannot delete posts");
  }

  if (input.target.unit?.user?.unitId === input.identity.userId) return;

  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: contentPolicyActions.delete,
    target: { kind: "post", id: input.target.unitId },
  });
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

async function assertPostCreatePolicy(input: {
  body: {
    targetUnitId?: string;
    realmUnitIds?: string[];
  };
  identity: any;
  status: any;
}) {
  const realmUnitId = input.body.realmUnitIds?.[0] ?? null;
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: contentPolicyActions.create,
    target: {
      kind: "post",
      id: input.body.targetUnitId ?? "new",
      realmUnitId,
    },
  });
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

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
            viewerUserId: identity?.userId,
          })
        : await postService.list(query, {
            isAdmin: admin,
            viewerUserId: identity?.userId,
          });
      const variantContexts = await hydrateVariantContextSummaries(posts);
      const languages = parseReadLanguages(query.languages);
      const response: PostListResponse = {
        posts: posts.map((post) =>
          mapPostToDTO(post, variantContexts, languages),
        ),
        total,
      };
      return response;
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
    "/moderation-overlays",
    async ({ body }): Promise<PostModerationOverlayResponse> => {
      const targetUnitIds = [...new Set(body.targetUnitIds)];
      const [globalStates, realmOverlays] = await Promise.all([
        governanceModerationService.listGlobalContentStates(targetUnitIds),
        body.realmUnitId
          ? governanceModerationService.listRealmContentOverlays({
              realmUnitId: body.realmUnitId,
              moderatedUnitIds: targetUnitIds,
            })
          : [],
      ]);
      return { globalStates, realmOverlays };
    },
    {
      body: postModerationOverlayRequestSchema,
      response: postModerationOverlayResponseSchema,
      detail: {
        summary: "Get post moderation overlays",
        description:
          "Return global moderation state and bounded realm overlay rows for the requested post node ids.",
        tags: ["Posts", "Governance"],
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

      const query = { ...body, ids: body.ids?.join(",") } as PostListQuery;
      const { posts, total } = body.realmUnitId
        ? await postService.byRealm(body.realmUnitId, query, {
            isAdmin: admin,
            viewerUserId: identity?.userId,
          })
        : await postService.list(query, {
            isAdmin: admin,
            viewerUserId: identity?.userId,
          });
      const variantContexts = await hydrateVariantContextSummaries(posts);
      const response: PostListResponse = {
        posts: posts.map((post) =>
          mapPostToDTO(post, variantContexts, body.languages ?? []),
        ),
        total,
      };
      return response;
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
    async ({ body, identity, status }): Promise<PostResponse | string> => {
      const denied = await assertPostCreatePolicy({ body, identity, status });
      if (denied) return denied;
      const post = await postService.create(body, identity.userId);
      return mapPostToDTO(post);
    },
    {
      requireLogin: true,
      body: createPostSchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Create post",
        description: "Create a new top-level post.",
        tags: ["Posts"],
      },
    },
  )
  .post(
    "/:unitId/publish",
    async ({ params, body, identity, status }) => {
      // Publishing makes the draft public, so it runs the create policy
      // (blocked/silenced authors are denied); reverting to draft does not.
      if (body.publish) {
        if (isBlocked(identity.permission)) {
          return status(403, "Forbidden: blocked users cannot publish posts");
        }
        const decision = await governanceRoutePolicyService.decideForIdentity({
          identity,
          action: contentPolicyActions.create,
          target: { kind: "post", id: params.unitId },
        });
        if (!decision.allowed) {
          return status(
            403,
            decision.safeMessage ?? "Forbidden: policy denied this action",
          );
        }
      }
      const post = await postService.setPublicationState(
        params.unitId,
        body.publish,
        identity.userId,
      );
      return mapPostToDTO(post);
    },
    {
      requireLogin: true,
      params: postParamsSchema,
      body: setPostPublicationSchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Publish or revert a post draft",
        description:
          "Owner-only toggle between published and draft. Publishing is policy-gated; reverting to draft removes the post from feeds and search.",
        tags: ["Posts"],
      },
    },
  )
  .post(
    "/:unitId/submit-to-realm",
    async ({ params, body, identity, status }) => {
      if (isBlocked(identity.permission)) {
        return status(403, "Forbidden: blocked users cannot submit posts");
      }
      const decision = await governanceRoutePolicyService.decideForIdentity({
        identity,
        action: contentPolicyActions.create,
        target: {
          kind: "post",
          id: params.unitId,
          realmUnitId: body.realmUnitId,
        },
      });
      if (!decision.allowed) {
        return status(
          403,
          decision.safeMessage ?? "Forbidden: policy denied this action",
        );
      }
      const post = await postService.submitToRealm(
        params.unitId,
        body,
        identity.userId,
      );
      return mapPostToDTO(post);
    },
    {
      requireLogin: true,
      params: postParamsSchema,
      body: submitPostToRealmSchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Submit an authored post to a realm",
        description:
          "Author/member operation for publishing an existing post or draft into a realm. It intentionally does not use the realm admin content route.",
        tags: ["Posts", "Realms"],
      },
    },
  )
  .post(
    "/:unitId/state",
    async ({ params, body, identity, set }): Promise<PostResponse> => {
      // `state` gates no behavior, but a transition is still an edit — reuse the
      // post-update permission (author / admin). The schema enforces which
      // values and transitions are legal (write-strict).
      const target = await postService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdatePost(
          identity.permission,
          identity.userId,
          target.unit as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to change this post's state",
        );
      }
      const updated = await postService.setState(params.unitId, body.state);
      return mapPostToDTO(updated);
    },
    {
      requireLogin: true,
      params: postParamsSchema,
      body: setPostStateSchema,
      detail: {
        summary: "Set post lifecycle state",
        description:
          "Transition a post's lifecycle state. Write-strict: validated against the post's schema (legal value + allowed transition). State gates no behavior.",
        tags: ["Posts"],
      },
    },
  )
  .post(
    "/pins",
    async ({ body, identity }) => {
      return postService.pin(body, identity);
    },
    {
      requireLogin: true,
      body: pinCommentSchema,
      response: { 200: commentPromotionDTOSchema },
      detail: {
        summary: "Pin a reply within its thread",
        description:
          "Promote a reply (kind=PINNED) in its thread scope. The scope must be the thread root post and the target a reply within it. Authorized to the thread author (OP) or a realm moderator/owner.",
        tags: ["Posts"],
      },
    },
  )
  .delete(
    "/pins/:scopeUnitId/:commentUnitId",
    async ({ params, identity }) => {
      await postService.unpin(
        params.scopeUnitId,
        params.commentUnitId,
        identity,
      );
      return { message: "Pin removed" };
    },
    {
      requireLogin: true,
      params: t.Object({
        scopeUnitId: t.String(),
        commentUnitId: t.String(),
      }),
      response: { 200: t.Object({ message: t.String() }) },
      detail: {
        summary: "Unpin a reply",
        description:
          "Remove a PINNED promotion. Same authorization as pinning.",
        tags: ["Posts"],
      },
    },
  )
  .post(
    "/accepted-answers",
    async ({ body, identity }) => {
      return postService.acceptAnswer(body, identity);
    },
    {
      requireLogin: true,
      body: acceptAnswerSchema,
      response: { 200: commentPromotionDTOSchema },
      detail: {
        summary: "Accept a direct reply as an answer",
        description:
          "Promote a direct comment reply (kind=ACCEPTED_ANSWER) in a Q&A thread (root bears the official question tag). Authorized to the OP or a realm moderator/owner.",
        tags: ["Posts"],
      },
    },
  )
  .delete(
    "/accepted-answers/:scopeUnitId/:commentUnitId",
    async ({ params, identity }) => {
      await postService.unacceptAnswer(
        params.scopeUnitId,
        params.commentUnitId,
        identity,
      );
      return { message: "Accepted answer removed" };
    },
    {
      requireLogin: true,
      params: t.Object({
        scopeUnitId: t.String(),
        commentUnitId: t.String(),
      }),
      response: { 200: t.Object({ message: t.String() }) },
      detail: {
        summary: "Unaccept an answer",
        description:
          "Remove an ACCEPTED_ANSWER promotion. Same authorization as accepting.",
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
      const patchLanguage =
        typeof postPatch.language === "string"
          ? (normalizeLanguage(postPatch.language) ?? undefined)
          : undefined;
      const currentContent =
        target.unit.contentTranslations.find(
          (translation) => translation.language === patchLanguage,
        )?.content ??
        target.unit.contentTranslations[0]?.content ??
        null;
      const updateInput = {
        title:
          typeof postPatch.title === "string" ? postPatch.title : undefined,
        content:
          postPatch.content !== undefined
            ? applySparsePatch(currentContent, postPatch.content)
            : undefined,
        language: patchLanguage,
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
        updateInput.title === undefined &&
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
    async ({
      params,
      identity,
      status,
    }): Promise<{ message: string } | string> => {
      const target = await postService.getByUnitId(params.unitId);
      const denied = await assertPostDeletePolicy({
        identity,
        status,
        target,
      });
      if (denied) return denied;
      await postService.delete(params.unitId);
      return { message: "Post deleted successfully" };
    },
    {
      requireLogin: true,
      params: postParamsSchema,
      response: {
        200: t.Object({ message: t.String() }),
        403: t.String(),
      },
      detail: {
        summary: "Delete post",
        description: "Delete a post by unit ID",
        tags: ["Posts"],
      },
    },
  );
