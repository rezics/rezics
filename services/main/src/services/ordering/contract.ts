/**
 * External callers cannot spend the storage safety margin. Fractional keys are
 * ASCII, so the API's string-length bound and this byte bound are equivalent.
 */
export const FractionalPositionInputMaximumBytes = 512;

/** Begin compacting an ordering scope before it consumes the storage margin. */
export const FractionalPositionRebalanceThresholdBytes = FractionalPositionInputMaximumBytes;

/**
 * Persisted ceiling for indexed fractional keys.
 *
 * PostgreSQL B-tree entries must fit on an index page. Keeping the position at
 * or below 1 KiB leaves substantial room for composite UUID and discriminator
 * columns while preserving a full 512-byte compaction runway beyond API input.
 */
export const FractionalPositionStorageMaximumBytes = 1_024;
