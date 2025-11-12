import type {PublicUser, ReadlistDTO} from '@package/contract';
import type {ReadlistSelected, ReadlistListSelected} from './types';

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
    title: row.unit?.title ?? '',
    coverUrl,
    content: row.unit?.content ?? undefined,
    creator: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    likes: row.unit?.reactions?.likeCount ?? 0,
    books: [],
    reviews: [],
  };
}

export function mapReadlistRowToDTO(row: ReadlistSelected): ReadlistDTO {
  const meta = (row.unit?.metadata as any) ?? {};
  const coverUrl = meta?.coverUrl ?? undefined;
  return {
    id: row.unitId,
    title: row.unit?.title ?? '',
    content: row.unit?.content ?? undefined,
    coverUrl,
    creator: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    likes: row.unit?.reactions?.likeCount ?? 0,
    books: (row.book ?? []).map(b => ({
      unitId: b.unitId,
      title: b.title,
      description: b.description ?? undefined,
      coverUrl: b.coverUrl ?? undefined,
      author: b.author,
    })),
    reviews: (row.review ?? []).map(r => ({
      unitId: r.id,
      title: r.title ?? undefined,
      targetUnitId: r.targetUnitId,
      content: r.content ?? undefined,
    })),
  } as ReadlistDTO;
}
