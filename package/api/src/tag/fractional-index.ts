/**
 * Re-export of the shared fractional-index helper. The original implementation
 * lives in `../shared/fractional-index.ts`. Tag-specific consumers may import
 * from here for historical reasons; new consumers SHOULD import from
 * `@rezics/api/shared/fractional-index`.
 */
export {
  generateKeyBetween,
  positionForNewBottomPin,
  positionForNewTopPin,
  POSITION_ALPHABET,
} from "../shared/fractional-index";
