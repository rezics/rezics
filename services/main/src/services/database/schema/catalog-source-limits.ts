/** Internal source publication budget; manual music edits retain their 128-row request limit. */
export const MUSIC_SOURCE_COMPONENT_LIMIT = 2048;
/** Evidence support is bounded independently of the number of changed native rows. */
export const MUSIC_SOURCE_OCCURRENCE_LIMIT = 4096;
export const SOURCE_ANCILLARY_CHANGE_LIMIT = 128;
export const MUSIC_SOURCE_APPLICATION_LIMIT = MUSIC_SOURCE_COMPONENT_LIMIT + SOURCE_ANCILLARY_CHANGE_LIMIT;
