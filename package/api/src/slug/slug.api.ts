import type {
  EntityDTO,
  ShelfDetailDTO,
  SlugResolvePayload,
  SlugResolveResponse,
  UserDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const slugApi = {
  /** Resolve `{ scope, slug }` to `{ unitId, type }`. */
  resolve: async (input: SlugResolvePayload): Promise<SlugResolveResponse> => {
    return apiFetch<SlugResolveResponse>("/slug/resolve", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Look up a user under the USER scope by slug. */
  userBySlug: async (slug: string): Promise<UserDTO> => {
    return apiFetch<UserDTO>(`/user/by-slug/${encodeURIComponent(slug)}`);
  },

  /**
   * Look up an entity under the ENTITY scope by slug. Returns 404 in v1 — no
   * ENTITY Unit carries a slug yet (`ENTITY_SLUG_WRITES_ENABLED=false`).
   */
  entityBySlug: async (slug: string): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/entity/by-slug/${encodeURIComponent(slug)}`);
  },

  /** Look up a SHELF Unit under an owner's scope by `(userSlug, slug)`. */
  shelfBySlug: async (
    userSlug: string,
    slug: string,
  ): Promise<ShelfDetailDTO> => {
    return apiFetch<ShelfDetailDTO>(
      `/shelf/by-slug/${encodeURIComponent(userSlug)}/${encodeURIComponent(slug)}`,
    );
  },
};
