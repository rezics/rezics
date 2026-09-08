/** Source publication uses bounded SQL pages; manual music edits retain their 128-row request limit. */
export const MUSIC_SOURCE_OCCURRENCE_LIMIT = 16384;
/** A complete replacement can remove every old occurrence and insert every incoming occurrence. */
export const MUSIC_SOURCE_COMPONENT_LIMIT = 2 * MUSIC_SOURCE_OCCURRENCE_LIMIT;
export const MUSIC_SOURCE_DEPENDENCY_LIMIT = 16384;
export const MUSIC_SOURCE_DEPENDENCY_POSITION_LIMIT = 2 * MUSIC_SOURCE_DEPENDENCY_LIMIT;
export const MUSIC_SOURCE_AUXILIARY_ROW_LIMIT = 16384;
export const SOURCE_ANCILLARY_CHANGE_LIMIT = 128;
export const MUSIC_SOURCE_APPLICATION_LIMIT = MUSIC_SOURCE_COMPONENT_LIMIT + SOURCE_ANCILLARY_CHANGE_LIMIT;
/** Exact archive byte budgets, independent of logical record or SQL batch limits. */
export const SOURCE_DOCUMENT_BYTE_LIMIT = 8_000_000;
export const SOURCE_MULTIPART_BYTE_LIMIT = 32_000_000;
export const SOURCE_MULTIPART_PART_LIMIT = 4;
export const SOURCE_MANIFEST_BYTE_LIMIT = 65_536;
/** Includes shared provider waits, all response bodies and archive writes under a 30-second task lease. */
export const SOURCE_ACQUISITION_IO_TIMEOUT_MS = 25_000;
