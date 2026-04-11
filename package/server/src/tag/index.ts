/**
 * Tags Service - Main exports
 *
 * Tags are Units with type=TAG and isLanguageNeutral=true.
 * Display labels live in UnitTranslation.
 * Tag-to-content associations use the scored UnitTag junction.
 * Users vote via TagVote.
 */

export { mapTagUnitToDTO, mapUnitTagToDTO } from "./tag.mapper";
export { tagApi } from "./tag.api";
export { TagService, tagService } from "./tag.service";
export type { TagWithTranslations, UnitTagWithRelations } from "./types";
