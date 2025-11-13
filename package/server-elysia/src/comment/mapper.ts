import type {CommentWithRelations} from './types';
import type {CommentDTO} from '@package/contract';

function sanitizeUser(u: CommentWithRelations['unit']['user']) {
  return {
    id: u.unitId,
    name: u.name,
    avatar: u.avatar ?? undefined,
  };
}

export function mapCommentToDTO(c: CommentWithRelations): CommentDTO {
  return {
    id: c.unitId,
    rootPostId: c.rootUnitId,
    parentCommentId: c.parentCommentId ?? null,
    depth: c.depth,
    content: c.unit.content ?? null,
    created_at: c.unit.createdAt?.toISOString(),
    user: c.unit.user ? sanitizeUser(c.unit.user) : undefined,
  };
}
