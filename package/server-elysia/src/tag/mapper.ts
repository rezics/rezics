import type {TagWithRelations} from './types';
import type {TagDTO, TagDetailDTO} from '@package/contract';

export function mapTagToDTO(tag: TagWithRelations): TagDTO {
  return {
    id: tag.unitId,
    name: tag.name,
    type: tag.type ?? null,
    domains: tag.unit.domains,
  };
}

export function mapTagDetailToDTO(tag: TagWithRelations): TagDetailDTO {
  return {
    ...mapTagToDTO(tag),
    i18n: tag.i18n ?? null,
    domains: tag.unit.domains?.map(d => d.id) ?? [],
    content: tag.unit.content ?? null,
  };
}
