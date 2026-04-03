import type {ChapterDetailDTO, ChapterListItemDTO} from '@rezics/contract';
import type {ChapterUnitWithRelations} from './types';

export function mapUnitToChapterListItemDTO(
  u: ChapterUnitWithRelations,
): ChapterListItemDTO {
  return {
    unitId: u.id,
    title: u.title ?? '',
    noContent: !(u.content && u.content.length > 0),
    userId: u.userId,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export function mapUnitToChapterDetailDTO(
  u: ChapterUnitWithRelations,
): ChapterDetailDTO {
  return {
    unitId: u.id,
    title: u.title ?? '',
    content: u.content ?? undefined,
    userId: u.userId,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
