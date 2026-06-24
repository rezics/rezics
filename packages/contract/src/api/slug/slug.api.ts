import type {
  EntityDTO,
  ShelfDetailDTO,
  SlugResolvePayload,
  SlugResolveResponse,
  UserDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const slugApi = {
  /**
   * Resolve `{ scope, slug }` to `{ unitId, type }`.
   * 将 `{ scope, slug }` 解析为 `{ unitId, type }`。
   */
  resolve: async (input: SlugResolvePayload): Promise<SlugResolveResponse> => {
    return apiFetch<SlugResolveResponse>("/slug/resolve", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Look up a user under the USER scope by slug.
   * 在 USER scope 下按 slug 查找用户。
   */
  userBySlug: async (slug: string): Promise<UserDTO> => {
    return apiFetch<UserDTO>(`/user/by-slug/${encodeURIComponent(slug)}`);
  },

  /**
   * Look up an entity under the ENTITY scope by slug. Returns 404 in v1 — no
   * ENTITY Unit carries a slug yet (`ENTITY_SLUG_WRITES_ENABLED=false`).
   * 在 ENTITY scope 下按 slug 查找实体。v1 中返回 404 —— 尚无 ENTITY Unit
   * 携带 slug（`ENTITY_SLUG_WRITES_ENABLED=false`）。
   */
  entityBySlug: async (slug: string): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/entity/by-slug/${encodeURIComponent(slug)}`);
  },

  /**
   * Look up a SHELF Unit under an owner's scope by `(userSlug, slug)`.
   * 在所有者 scope 下按 `(userSlug, slug)` 查找 SHELF Unit。
   */
  shelfBySlug: async (
    userSlug: string,
    slug: string,
  ): Promise<ShelfDetailDTO> => {
    return apiFetch<ShelfDetailDTO>(
      `/shelf/by-slug/${encodeURIComponent(userSlug)}/${encodeURIComponent(slug)}`,
    );
  },
};
