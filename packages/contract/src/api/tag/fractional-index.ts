/**
 * Compatibility re-export for historical tag imports. New code should import
 * shared ordering helpers from `@rezics/contract/shared/fractional-index`.
 */
export {
  generateKeyBetween,
  POSITION_ALPHABET,
  positionForNewBottomPin,
  positionForNewTopPin,
} from "@rezics/contract/shared/fractional-index";
