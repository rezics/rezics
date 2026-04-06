import type { PublicUser, ReadlistDTO } from "@rezics/contract";
import { mapReviewToDTO } from "../review/mapper";
import type { ReadlistListSelected, ReadlistSelected } from "./types";

export function sanitizeUser(u: {
  unitId: string;
  slug?: string;
  name: string;
  avatar?: string | null;
}): PublicUser {
  return {
    unitId: u.unitId,
    slug: u.slug,
    name: u.name,
    avatar: u.avatar ?? (null as any),
  };
}

// Simple mappers for readlist service shapes
export function mapReadlistListRowToDTO(
  row: ReadlistListSelected,
): ReadlistDTO {
  const meta = (row.unit?.metadata as any) ?? {};
  const coverUrl = meta?.coverUrl ?? undefined;
  return {
    id: row.unitId,
    title: row.unit?.title ?? "",
    coverUrl,
    content: row.unit?.content ?? undefined,
    creator: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    reactionSummaries: row.unit?.reactionSummaries ?? [],
    books: [],
    reviews: [],
  };
}

export function mapReadlistRowToDTO(row: ReadlistSelected): ReadlistDTO {
  const meta = (row.unit?.metadata as any) ?? {};
  const coverUrl = meta?.coverUrl ?? undefined;
  return {
    id: row.unitId,
    title: row.unit?.title ?? "",
    content: row.unit?.content ?? undefined,
    reactionSummaries: row.unit?.reactionSummaries ?? [],
    coverUrl,
    creator: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    books: (row.book ?? []).map((b) => ({
      unitId: b.unitId,
      title: b.title,
      description: b.description ?? undefined,
      coverUrl: b.coverUrl ?? undefined,
      author: b.author,
    })),
    reviews: (row.review ?? []).map((r) => {
      const result: any = mapReviewToDTO(r as any);
      result.targetUnitId = r.targetUnitId;
      return result;
    }),
    order: row.order ?? [],
  } as ReadlistDTO;
}
