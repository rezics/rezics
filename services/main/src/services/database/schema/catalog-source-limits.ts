/** Source publication uses bounded SQL pages; manual music edits retain their 128-row request limit. */
export const MUSIC_SOURCE_OCCURRENCE_LIMIT = 16384;
/** A complete replacement can remove every old occurrence and insert every incoming occurrence. */
export const MUSIC_SOURCE_COMPONENT_LIMIT = 2 * MUSIC_SOURCE_OCCURRENCE_LIMIT;
export const MUSIC_SOURCE_DEPENDENCY_LIMIT = 16384;
export const MUSIC_SOURCE_DEPENDENCY_POSITION_LIMIT = 2 * MUSIC_SOURCE_DEPENDENCY_LIMIT;
export const MUSIC_SOURCE_AUXILIARY_ROW_LIMIT = 16384;
export const SOURCE_ANCILLARY_CHANGE_LIMIT = 128;
export const MUSIC_SOURCE_APPLICATION_LIMIT = MUSIC_SOURCE_COMPONENT_LIMIT + SOURCE_ANCILLARY_CHANGE_LIMIT;
